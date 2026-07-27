const filterClients = (role, clientList) => {
    const filter = {
        'caregiver': ['active'],
        'admin': ['active', 'inactive']
    }
    return clientList.filter(client => filter[role]?.includes(client.status));
}

module.exports = { filterClients };