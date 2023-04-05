const STATUS_CODES = {
    OFFLINE: 'offline',
    ONLINE: 'online',
    IDLE: 'idle',
};

const isStatus = (status) => {
    return Object.values(STATUS_CODES).includes(status);
};

export {
    STATUS_CODES,
    isStatus,
}