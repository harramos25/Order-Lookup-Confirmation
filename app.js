/**
 * Client-Side Data Simulation Controller
 * Handles "backend" logic: Looking up users, logging confirmations, and session management.
 */

const App = {
    // Keys for storage
    STORAGE_KEY: 'cassncase_confirm_log',
    SESSION_KEY: 'cassncase_current_order_id',
    UPDATE_SELECTION_KEY: 'cassncase_update_fields',

    /**
     * Initialize the system.
     * Ensures our "database" (localStorage) has a log container.
     */
    init: function () {
        console.log("App Initialized. Mode: Client-Side Simulation");
        if (!localStorage.getItem(this.STORAGE_KEY)) {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify([]));
        }
    },

    /**
     * Search for a buyer by Email or Phone.
     * @param {string} query - Email or Phone number
     * @returns {object|null} - Buyer object if found, else null
     */
    findBuyer: function (query) {
        if (!query) return null;
        const normalizedQuery = query.toLowerCase().trim();

        // Search in the static "Spreadsheet" data
        // Accessing the global MOCK_BUYERS defined in buyers.js
        if (typeof window.MOCK_BUYERS === 'undefined') {
            console.error("MOCK_BUYERS data not loaded!");
            return null;
        }

        const buyer = window.MOCK_BUYERS.find(b =>
            b.email.toLowerCase() === normalizedQuery ||
            b.phone === normalizedQuery
        );

        return buyer || null;
    },

    /**
     * Start a session for a specific buyer.
     * Uses sessionStorage so the URL remains clean and private.
     */
    startSession: function (buyerId) {
        sessionStorage.setItem(this.SESSION_KEY, buyerId);
    },

    /**
     * Get the current buyer in the "session".
     * Merges the static "Spreadsheet" data with any "live" updates from localStorage.
     */
    getCurrentBuyer: function () {
        const buyerId = sessionStorage.getItem(this.SESSION_KEY);
        if (!buyerId) return null;

        const originalBuyer = window.MOCK_BUYERS.find(b => b.id === buyerId);
        if (!originalBuyer) return null;

        // Check for updates in localStorage
        const logs = this.getLogs();
        // Find the LATEST update for this buyer
        // (In a real system, we might replay all events. Here, we just grab the last update action)
        const updates = logs.filter(log => log.buyerId === buyerId && log.action === 'UPDATE');

        let mergedBuyer = { ...originalBuyer };

        if (updates.length > 0) {
            // Apply updates sequentially
            updates.forEach(update => {
                if (update.changes) {
                    mergedBuyer = { ...mergedBuyer, ...update.changes };
                }
            });
            // Mark status as Updated/Confirmed
            mergedBuyer.status = "Confirmed (Updated)";
        }

        // Also check if there's just a simple CONFIRM action
        const confirmation = logs.find(log => log.buyerId === buyerId && log.action === 'CONFIRM');
        if (confirmation && mergedBuyer.status === "Pending Confirmation") {
            mergedBuyer.status = "Confirmed";
        }

        return mergedBuyer;
    },

    /**
     * Log an action (CONFIRM or UPDATE).
     * This simulates writing to a database log table.
     */
    logAction: function (buyerId, action, changes = null) {
        const logs = this.getLogs();
        const newLog = {
            id: 'LOG-' + Date.now(),
            buyerId: buyerId,
            action: action, // 'CONFIRM' or 'UPDATE'
            changes: changes,
            timestamp: new Date().toISOString()
        };
        logs.push(newLog);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(logs));
    },

    /**
     * Helper to get all logs.
     */
    getLogs: function () {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    },

    // --- Navigation Helpers --- //

    /**
     * Save selected fields for update (for the next page).
     */
    setUpdateSelection: function (fields) {
        sessionStorage.setItem(this.UPDATE_SELECTION_KEY, JSON.stringify(fields));
    },

    getUpdateSelection: function () {
        const data = sessionStorage.getItem(this.UPDATE_SELECTION_KEY);
        return data ? JSON.parse(data) : [];
    }
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
