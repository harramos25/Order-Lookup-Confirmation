// MOCK DATA - Read Only Source (Simulating "Spreadsheet" Rows)
const MOCK_BUYERS = [
    {
        id: "ORD-001",
        fullName: "Skylar Millie Parker",
        email: "sky@example.com",
        phone: "09123456789",
        address: "123 Mabini Street, Barangay San Isidro, Quezon City, Metro Manila",
        shippingAddress: "123 Mabini Street, Barangay San Isidro, Quezon City, Metro Manila",
        orderType: "Hardbound",
        status: "Pending Confirmation"
    },
    {
        id: "ORD-002",
        fullName: "Patricia Mae Villanueva",
        email: "pat@example.com",
        phone: "09987654321",
        address: "Block 7 Lot 12, Palm Grove Subdivision, Barangay Alijis, Bacolod City, Negros Occidental",
        shippingAddress: "Block 7 Lot 12, Palm Grove Subdivision, Barangay Alijis, Bacolod City, Negros Occidental",
        orderType: "Paperback",
        status: "Pending Confirmation"
    },
    {
        id: "ORD-003",
        fullName: "Maria Angela Cruz",
        email: "maria@example.com",
        phone: "09234567890",
        address: "Unit 4B, Sunrise Apartments, J.P. Rizal Avenue, Makati City, Metro Manila",
        shippingAddress: "Unit 4B, Sunrise Apartments, J.P. Rizal Avenue, Makati City, Metro Manila",
        orderType: "Hardbound",
        status: "Pending Confirmation"
    },
    {
        id: "ORD-004",
        fullName: "Angela Mae Santos",
        email: "angela@example.com",
        phone: "09345678901",
        address: "Unit 12A, Bluewave Residences, Roxas Boulevard, Pasay City, Metro Manila",
        shippingAddress: "Unit 12A, Bluewave Residences, Roxas Boulevard, Pasay City, Metro Manila",
        orderType: "Paperback",
        status: "Pending Confirmation"
    },
    {
        id: "ORD-005",
        fullName: "Kimberly Rose Mendoza",
        email: "kim@example.com",
        phone: "09456789012",
        address: "67 Mabini Road, Barangay Balulang, Cagayan de Oro City, Misamis Oriental",
        shippingAddress: "67 Mabini Road, Barangay Balulang, Cagayan de Oro City, Misamis Oriental",
        orderType: "Hardbound",
        status: "Pending Confirmation"
    }
];

// Export for usage if using modules, but for this simple prototype we'll likely load it as a script global or similar.
// We will assign it to window to ensure availability in our vanilla JS architecture.
window.MOCK_BUYERS = MOCK_BUYERS;
