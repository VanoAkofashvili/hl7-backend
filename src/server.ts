import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import HL7 from 'hl7-standard';

import { getAge, groupHL7Records, loadCSVData } from './lib';
import { GenderMap, HL7InfoMap } from './constants';


async function initialize() {
    const [metrics, conditions] = await Promise.all([
        loadCSVData(path.join(__dirname, '../diagnostic_metrics.csv')),
        loadCSVData(path.join(__dirname, '../conditions.csv'))
    ]);

    const app = express();
    const port = 3001;

    app.use(cors());
    app.use(bodyParser.json());

    const storage = multer.memoryStorage();
    const upload = multer({ storage: storage });


    app.post('/api/upload', upload.single('oruFile'), async (req: Request, res: Response) => {
        if (!req.file) {
            res.status(400).send("No file uploaded")
            return
        }
        try {
            const oruFileContent = req.file.buffer.toString('utf-8');
            const records = groupHL7Records(oruFileContent);

            const highRiskResults = records.flatMap(record => {
                const hl7 = new HL7(record);
                hl7.transform();
                const age = getAge(hl7.get(HL7InfoMap.PID.AGE));
                const sonicCode = hl7.get(HL7InfoMap.OBX.SONIC_CODE);
                const gender = GenderMap[hl7.get(HL7InfoMap.PID.GENDER)] || "Any";
                const unit = hl7.get(HL7InfoMap.OBX.UNIT);
                let testValue = hl7.get(HL7InfoMap.OBX.VALUE);
                if (typeof testValue === 'object') testValue = testValue['OBX.5.2'];
                const testName = hl7.get(HL7InfoMap.OBX.TEST_NAME);

                // Matching metrics
                const matchingMetrics = metrics.filter(metric => {
                    return metric.oru_sonic_codes.includes(sonicCode) && metric.oru_sonic_units.includes(unit);
                });

                let relevantMetric = matchingMetrics.find(metric =>
                    (metric.min_age === '' || age >= parseInt(metric.min_age)) &&
                    (metric.max_age === '' || age <= parseInt(metric.max_age)) &&
                    (metric.gender === 'Any' || metric.gender === gender)
                ) || matchingMetrics[0];

                if (relevantMetric && relevantMetric.everlab_lower && relevantMetric.everlab_higher) {
                    const lowerBound = parseFloat(relevantMetric.everlab_lower);
                    const upperBound = parseFloat(relevantMetric.everlab_higher);
                    const numericValue = parseFloat(testValue);

                    if (!isNaN(numericValue) && (numericValue < lowerBound || numericValue > upperBound)) {
                        return [{
                            condition: conditions.find(condition => condition.diagnostic_metrics === relevantMetric.name)?.name || '',
                            testName: testName || relevantMetric.name,
                            observedValue: testValue,
                            units: unit,
                            everlabRange: `${relevantMetric.everlab_lower} - ${relevantMetric.everlab_higher}`,
                            standardRange: `${relevantMetric.standard_lower || 'N/A'} - ${relevantMetric.standard_higher || 'N/A'}`,
                        }];
                    }
                }

                return [];
            });

            res.json(highRiskResults);
        } catch (error) {
            console.error(error);
            res.status(500).send('Error processing the file.');
        }
    });

    app.listen(port, async () => {
        console.log(`Backend server running on http://localhost:${port}`);
    });
}

initialize().catch(err => {
    console.error('Error during initialization:', err);
});
