/**
 * StorageService
 * Dito naka-manage yung pag-save ng data natin (IndexedDB o Sheets).
 */
const StorageService = {
    dbName: 'CassNcaseDB',
    dbVersion: 6,
    db: null,
    mode: 'PROTOTYPE', // 'PROTOTYPE' | 'SHEETS'
    apiConfig: {
        readUrl: '', // Apps Script Web App URL
        writeUrl: ''
    },

    /**
     * I-init muna yung storage natin.
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
                    console.log("StorageService: Inaayos yung DB at nililinis yung data...");

                    // Burahin muna yung mga lumang stores para fresh yung seed
                    if (db.objectStoreNames.contains('orders')) {
                        db.deleteObjectStore('orders');
                    }
                    if (db.objectStoreNames.contains('logs')) {
                        db.deleteObjectStore('logs');
                    }

                    // Gawa tayo ng bagong stores dito
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

                        // Seed natin automatically pag empty
                        const transaction = this.db.transaction(['orders'], 'readwrite');
                        const store = transaction.objectStore('orders');
                        const countRequest = store.count();

                        countRequest.onsuccess = () => {
                            if (countRequest.result === 0 && window.MOCK_BUYERS) {
                                console.log("StorageService: Nilalagay na yung Mock Data...");
                                window.MOCK_BUYERS.forEach(buyer => {
                                    const order = {
                                        order_id: buyer.id,
                                        full_name: buyer.fullName,
                                        email: buyer.email,
                                        phone: buyer.phone,
                                        address: buyer.shippingAddress,
                                        order_type: buyer.orderType,
                                        status: buyer.status || 'Pending' // Default muna sa Pending
                                    };
                                    store.put(order);
                                });

                                // Hintayin muna matapos yung transaction bago mag-resolve
                                transaction.oncomplete = () => {
                                    console.log("StorageService: Seeded " + window.MOCK_BUYERS.length + " orders.");
                                    resolve(true);
                                };

                                transaction.onerror = (e) => {
                                    console.error("Seeding failed", e);
                                    reject("Seeding failed");
                                }
                            } else {
                                // Hindi na kailangan mag-seed, okay na
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
     * Bulk Import ng Master Data (Para sa Admin)
     * Papalitan nito yung mga lumang data.
     * @param {Array} orders - Array ng mga order objects
     */
    importOrders: async function (orders) {
        if (this.mode !== 'PROTOTYPE') return; // TODO: Sheets mode logic

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['orders'], 'readwrite');
            const store = transaction.objectStore('orders');

            // Linisin muna natin bago baguhin? O dagdag lang?
            // "Clear Data" is separate. "Import" baka additive o replace.
            // Assumption muna tayo: Import adds/overwrites base sa ID.

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
     * Burahin lahat ng Data (Admin)
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

        // Privacy: Pag maraming match o wala, handle natin nang maayos. 
        // Strict tayo dito: "Lookup by your ID", kailangan unique email/phone.
        // Kung may duplicate, sabi ng requirement "prefer matching by order_id... otherwise show select card".
        // Balik muna natin yung FIRST match para ma-compute yung state.

        if (orders.length === 0) return null;

        // 2. Compute State for the first match
        // Kung sakaling maraming duplicate, kailangan natin mag-pakita ng select card.
        // Pero sa ngayon, balik muna natin yung pinaka-unang match para ma-compute.
        const order = orders[0];
        return await this.getComputedState(order.order_id);
    },

    /**
     * Kunin yung computed state para sa order (Project updates)
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

        // Tingnan natin yung status base sa logs? 
        // Master record may 'status'. Logs baka may 'CONFIRM'.
        // Kung master record ay 'PENDING' pero may 'CONFIRM' log, i-override natin.
        const hasConfirm = logs.some(l => l.action_type === 'CONFIRM');
        if (hasConfirm && finalState.status === 'Pending') { // Ang default natin ay 'Pending'
            finalState.status = 'Confirmed';
        }

        // if (updates.length > 0) {
        //    finalState.status = 'Confirmed (Updated)'; // TANGGAL na to sabi ni user
        // }

        return finalState;
    },

    /**
     * I-log yung action na ginawa
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
                            // Apply changes sa master record natin
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
     * Broadcast yung Update (Real-Time yan)
     */
    notifyChange: function (type) {
        const channel = new BroadcastChannel('cassncase_updates');
        channel.postMessage({ type: type, timestamp: Date.now() });
        channel.close(); // Send na natin tapos close na (admin yung makikinig dito)
    },

    /**
     * Kunin lahat ng logs (Para sa Admin Export)
     */
    getAllLogs: async function () {
        if (this.mode !== 'PROTOTYPE') return []; // TODO: Ayusin to pag Sheets mode na
        return new Promise((resolve) => {
            const request = this.db.transaction('logs').objectStore('logs').getAll();
            request.onsuccess = () => resolve(request.result);
        });
    },

    /**
     * Kunin lahat ng orders (Para sa Admin Table)
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

            // Kunin lahat para sa client-side filtering (simple lang to kesa complex indices)
            // Pero ideal talaga gumamit ng index.
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
                console.log(`StorageSearch: Nakahanap tayo ng ${matches.length} matches.`);
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
