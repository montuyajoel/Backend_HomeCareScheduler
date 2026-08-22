//clientFilter.js -Client Filter Utility Function
/*Central list of all valid client statuses.
This utility function is used to filter clients based on their status and the role of the user making the request.
It ensures that caregivers only see 'active' clients, while admins can see all clients.
The valid client statuses are defined in the constants/clientStatuses.js file,
which is imported here to ensure consistency across the application.
 */

const { CLIENT_STATUSES } = require("../constants/clientStatuses"); //import the list of valid client statuses

const filterClients = (role, clients) => {
    // Admins can see all clients, don't need filtering, it means admin can still find and correct records 
    // where staff may have set the invalid or unexpectedstatus by mistake.
    if (role === 'admin') {
        return clients;
    }

    //Other roles are restricted to a specific subset of CLIENT_STATUSES, future roles can be added here with their own filtering logic.
    const filter = {
        'caregiver': ['active'],
        //'admin': ['active', 'inactive']
    }
    return clients.filter(client => filter[role]?.includes(client.status));
}

//admin filter an already-accessible client list by one or more specific statuses.
const filterByStatus = (clients, statuses) => {
    const wantedStatuses = Array.isArray(statuses) ? statuses : [statuses];

    //validate against CLIENT_STATUSES to ensure only valid statuses are used for filtering,
    //instead of silently returning an empty list or throwing an error.
    const invalidStatuses = wantedStatuses.filter(s => !CLIENT_STATUSES.includes(s));
    if (invalidStatuses.length > 0) {
        throw new Error(`Invalid status filter: ${invalidStatuses.join(', ')}. Valid statuses are: ${CLIENT_STATUSES.join(', ')}`);
    }

    return clients.filter(client => wantedStatuses.includes(client.status));
};

module.exports = { filterClients, filterByStatus, CLIENT_STATUSES };