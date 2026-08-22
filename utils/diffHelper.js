//Helper: compare old and new address, return only the fields that actually changed
function getAddressDiff(oldAddress, newAddress) {
    const fields = ['addressLine', 'town', 'city', 'county', 'postCode', 'latitude', 'longitude'];
    const diff = {};
    fields.forEach(field => {
        if (oldAddress?.[field] !== newAddress?.[field]) {
            diff[field] = {before: oldAddress?.[field] ?? null, after: newAddress?.[field] ?? null };
        }
    });
    return diff;

}

module.exports = { getAddressDiff };