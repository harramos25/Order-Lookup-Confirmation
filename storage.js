/**
 * StorageService
 * Handles data persistence via IndexedDB (Prototype Mode) or Google Sheets API (Production Mode).
 */
const StorageService = {
    dbName: 'CassNcaseDB',
    dbVersion: 5,
    db: null,
    mode: 'PROTOTYPE', // 'PROTOTYPE' | 'SHEETS'
    apiConfig: {
        readUrl: '', // Apps Script Web App URL
        writeUrl: ''
    },

    /**
     * Initialize Storage
     */
    init: async function () {
        if (this.db) return Promise.resolve(true);

        return new Promise((resolve, reject) => {
            if (this.mode === 'PROTOTYPE') {
                const request = indexedDB.open(this.dbName, this.dbVersion);

                request.onerror = (event) => {
                    console.error("IndexedDB Error:", event);
                    reject("Failed to open database.");
                };

                request.onupgradeneeded = (event) => {
                    const db = event.target.result;
                    console.log("StorageService: Upgrading DB and Flushing Data...");

                    // Force Delete Old Stores for Clean Seed
                    if (db.objectStoreNames.contains('orders')) {
                        db.deleteObjectStore('orders');
                    }
                    if (db.objectStoreNames.contains('logs')) {
                        db.deleteObjectStore('logs');
                    }

                    // Create New Stores
                    const orderStore = db.createObjectStore('orders', { keyPath: 'order_id' });
                    orderStore.createIndex('email', 'email', { unique: false });
                    orderStore.createIndex('phone', 'phone', { unique: false });

                    const logStore = db.createObjectStore('logs', { keyPath: 'log_id' });
                    logStore.createIndex('order_id', 'order_id', { unique: false });
                };

                request.onsuccess = async (event) => {
                    try {
                        this.db = event.target.result;
                        console.log("StorageService: DB Connected (Prototype Mode)");

                        // Auto-seed if empty
                        const transaction = this.db.transaction(['orders'], 'readwrite');
                        const store = transaction.objectStore('orders');
                        const countRequest = store.count();

                        countRequest.onsuccess = () => {
                            if (countRequest.result === 0 && window.MOCK_BUYERS) {
                                console.log("StorageService: Seeding Mock Data...");
                                window.MOCK_BUYERS.forEach(buyer => {
                                    const order = {
                                        order_id: buyer.id,
                                        full_name: buyer.fullName,
                                        email: buyer.email,
                                        phone: buyer.phone,
                                        address: buyer.shippingAddress,
                                        order_type: buyer.orderType,
                                        status: buyer.status || 'Pending'
                                    };
                                    store.put(order);
                                });

                                // Wait for transaction to finish before resolving init
                                transaction.oncomplete = () => {
                                    console.log("StorageService: Seeded " + window.MOCK_BUYERS.length + " orders.");
                                    resolve(true);
                                };

                                transaction.onerror = (e) => {
                                    console.error("Seeding failed", e);
                                    reject("Seeding failed");
                                }
                            } else {
                                // No seeding needed
                                resolve(true);
                            }
                        };

                        countRequest.onerror = () => {
                            console.error("Count check failed");
                            resolve(true); // Proceed anyway?
                        };
                    } catch (e) {
                        console.error("Storage Init Logic Error", e);
                        reject(e);
                    }
                };
            } else {
                // Sheets Mode Init (Placeholder)
                console.log("StorageService: Sheets Mode");
                resolve(true);
            }
        });
    },

    /**
     * Import Bulk Master Data (Admin)
     * Replaces existing master data.
     * @param {Array} orders - Array of order objects
     */
    importOrders: async function (orders) {
        if (this.mode !== 'PROTOTYPE') return; // TODO: Sheets mode logic

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');

            // Clear old data first? Or Upsert?
            // Requirement: "Clear Data" is separate. "Import" might be additive or replace.
            // Let's assume Import adds/overwrites based on ID.

            orders.forEach(order => {
                if (!order.order_id) return; // Skip invalid
                store.put(order);
            });

            transaction.oncomplete = () => {
                console.log(`Imported ${orders.length} orders.`);
                resolve(orders.length);
            };

            transaction.onerror = () => reject("Import failed");
        });
    },

    /**
     * Clear All Data (Admin)
     */
    clearAllData: async function () {
        if (this.mode !== 'PROTOTYPE') return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders', 'logs'], 'readwrite');
            transaction.objectStore('orders').clear();
            transaction.objectStore('logs').clear();

            transaction.oncomplete = () => {
                console.log("All data cleared.");
                resolve(true);
            };
            transaction.onerror = () => reject("Clear failed");
        });
    },

    /**
     * Search for a single buyer.
     * @param {string} query - Email or Phone
     * @returns {Promise<Object|null>} - Returns Computed State (Master + Logs)
     */
    searchBuyer: async function (query) {
        if (!query) return null;
        const normalizedQuery = query.trim().toLowerCase();

        // 1. Find Order(s)
        const orders = await this._findOrdersByQuery(normalizedQuery);

        // Privacy: If multiple matches or 0 matches, handle gracefully. 
        // For strictly "Lookup by your ID", we usually expect unique email/phone.
        // If duplicates exist, the requirement says "prefer matching by order_id... otherwise show select card".
        // For now, let's return the FIRST match to compute state.

        if (orders.length === 0) return null;

        // 2. Compute State for the first match
        // (In a real app handling duplicates, we'd return a list of matches with partial info)
        const order = orders[0];
        return await this.getComputedState(order.order_id);
    },

    /**
     * Get computed state for an order (Project updates)
     */
    getComputedState: async function (orderId) {
        const order = await this._getOrder(orderId);
        if (!order) return null;

        const logs = await this._getLogsForOrder(orderId);

        // Replay Logs
        let finalState = { ...order };

        // Filter Updates
        const updates = logs.filter(l => l.action_type === 'UPDATE').sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        updates.forEach(u => {
            if (u.updated_fields_json) {
                try {
                    const changes = JSON.parse(u.updated_fields_json);
                    finalState = { ...finalState, ...changes };
                } catch (e) { console.error("Bad log JSON", e); }
            }
        });

        // Determine Status based on logs? 
        // Master has 'status'. Logs might 'CONFIRM'.
        // If master says 'PENDING' but log has 'CONFIRM', override?
        const hasConfirm = logs.some(l => l.action_type === 'CONFIRM');
        if (hasConfirm && finalState.status === 'Pending') { // Assuming 'Pending' is default
            finalState.status = 'Confirmed';
        }

        // if (updates.length > 0) {
        //    finalState.status = 'Confirmed (Updated)'; // REMOVED per user request
        // }

        return finalState;
    },

    /**
     * Log an action
     */
    logAction: async function (orderId, actionType, changes = {}) {
        const logEntry = {
            log_id: crypto.randomUUID(),
            order_id: orderId,
            action_type: actionType,
            timestamp: new Date().toISOString(),
            updated_fields_json: JSON.stringify(changes),
            source: 'buyer' // or admin
        };

        if (this.mode === 'PROTOTYPE') {
            return new Promise((resolve, reject) => {
                // Open transaction for both locally to ensure atomicity
                const transaction = this.db.transaction(['logs', 'orders'], 'readwrite');

                // 1. Add Log
                const logStore = transaction.objectStore('logs');
                logStore.add(logEntry);

                // 2. Sync to Master Data if Update
                if (actionType === 'UPDATE' && changes && Object.keys(changes).length > 0) {
                    const orderStore = transaction.objectStore('orders');
                    const getRequest = orderStore.get(orderId);

                    getRequest.onsuccess = () => {
                        const order = getRequest.result;
                        if (order) {
                            // Apply changes to master record
                            Object.assign(order, changes);
                            orderStore.put(order);
                            console.log("StorageService: Master Data synced with update.", changes);
                        }
                    };
                }

                transaction.oncomplete = () => {
                    this.notifyChange('DATA_CHANGED');
                    resolve(logEntry);
                };
                transaction.onerror = () => reject("Log/Sync failed");
            });
        }
    },

    /**
     * Broadcast Update (Real-Time)
     */
    notifyChange: function (type) {
        const channel = new BroadcastChannel('cassncase_updates');
        channel.postMessage({ type: type, timestamp: Date.now() });
        channel.close(); // Send and close (admin will listen)
    },

    /**
     * Get all logs (Admin Export)
     */
    getAllLogs: async function () {
        if (this.mode !== 'PROTOTYPE') return []; // TODO
        return new Promise((resolve) => {
            const request = this.db.transaction('logs').objectStore('logs').getAll();
            request.onsuccess = () => resolve(request.result);
        });
    },

    /**
     * Get all orders (Admin Table)
     */
    getAllOrders: async function () {
        if (this.mode !== 'PROTOTYPE') return [];
        return new Promise((resolve) => {
            const request = this.db.transaction('orders').objectStore('orders').getAll();
            request.onsuccess = () => resolve(request.result);
        });
    },

    // --- Private IDB Helpers ---

    _findOrdersByQuery: async function (q) {
        if (this.mode !== 'PROTOTYPE') return [];
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['orders'], 'readonly');
            const store = transaction.objectStore('orders');
            let results = [];

            // Getting all for client-side filtering (simplest for multi-field search without complex indices)
            // Ideally use index.
            const request = store.getAll();

            request.onsuccess = () => {
                const all = request.result;
                console.log(`StorageSearch: Querying "${q}" against ${all.length} records.`);

                // Filter matches
                const matches = all.filter(o => {
                    const emailMatch = o.email && o.email.toLowerCase() === q;
                    const phoneMatch = o.phone && o.phone.replace(/\D/g, '') === q.replace(/\D/g, '');
                    const idMatch = o.order_id === q;

                    if (emailMatch || phoneMatch || idMatch) {
                        console.log("Match Found:", o);
                        return true;
                    }
                    return false;
                });
                console.log(`StorageSearch: Found ${matches.length} matches.`);
                resolve(matches);
            };
        });
    },

    _getOrder: async function (id) {
        return new Promise((resolve) => {
            const request = this.db.transaction('orders').objectStore('orders').get(id);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    },

    _getLogsForOrder: async function (id) {
        return new Promise((resolve) => {
            const transaction = this.db.transaction(['logs'], 'readonly');
            const index = transaction.objectStore('logs').index('order_id');
            const request = index.getAll(id);
            request.onsuccess = () => resolve(request.result);
        });
    }
};

window.StorageService = StorageService;
