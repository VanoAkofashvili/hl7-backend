const GenderMap = { M: "Male", F: "Female" };
const HL7InfoMap = {
    PID: { AGE: "PID.7", GENDER: "PID.8" },
    OBX: { SONIC_CODE: "OBX.3.2", UNIT: "OBX.6.1", VALUE: "OBX.5", TEST_NAME: "OBX.3.1" }
};

export {
    GenderMap,
    HL7InfoMap
}