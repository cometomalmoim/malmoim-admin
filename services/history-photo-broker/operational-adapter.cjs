// Trusted operator bootstrap only. No JSON/env flag may create authenticated ports.
// A deployment-specific wrapper must obtain reviewed SERVER dependencies and pass them.
exports.createPorts=async function({modules,dependencies}){
 if(!modules?.['broker-composition']?.createOperationalPhotoBroker)throw Error('Photo broker composition unavailable');
 return modules['broker-composition'].createOperationalPhotoBroker(dependencies);
};
