/**
 * Client-Side Controller
 * generic 'App' glue code that bridges UI and StorageService.
 */

const App = {
    SESSION_KEY: 'cassncase_current_order_id',
    UPDATE_SELECTION_KEY: 'cassncase_update_fields',

    /**
     * Initialize the system.
     */
    init: async function () {
        console.log("App Initializing...");
        try {
            await StorageService.init();
            console.log("App Ready.");
        } catch (e) {
            console.error("App Init Failed:", e);
            alert("System Error: Storage could not be initialized.");
        }
    },

    /**
     * Search for a buyer by Email or Phone.
     * @param {string} query - Email or Phone number
     * @returns {Promise<object|null>} - Computed Buyer State
     */
    findBuyer: async function (query) {
        return await StorageService.searchBuyer(query);
    },

    /**
     * Start a session for a specific buyer.
     */
    startSession: function (buyerId) {
        sessionStorage.setItem(this.SESSION_KEY, buyerId);
    },

    /**
     * Get the current buyer in the "session".
     */
    getCurrentBuyer: async function () {
        const buyerId = sessionStorage.getItem(this.SESSION_KEY);
        if (!buyerId) return null;
        return await StorageService.getComputedState(buyerId);
    },

    /**
     * Log an action (CONFIRM or UPDATE).
     */
    logAction: async function (buyerId, action, changes = null) {
        await StorageService.logAction(buyerId, action, changes);
    },

    /**
     * Helper to get logs (for Admin).
     */
    getLogs: async function () {
        // This was for the old generic table. 
        // Admin will use StorageService directly usually, but we keep this for compatibility if needed.
        return await StorageService.getAllLogs();
    },

    // --- Navigation Helpers --- //

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
