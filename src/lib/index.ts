import fs from 'fs';
import csv from 'csv-parser';
import moment from 'moment';

const loadCSVData = (filePath: string): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        const results: any[] = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', data => results.push(data))
            .on('end', () => resolve(results))
            .on('error', reject);
    });
};

const getAge = (dob: string): number => {
    const birthDate = moment(dob, "YYYYMMDD");
    const currentDate = moment();
    let age = currentDate.diff(birthDate, 'years');
    if (currentDate.isBefore(birthDate.clone().add(age, 'years'))) age--;
    return age;
};

const groupHL7Records = (data: string): string[] => {
    return data.split('MSH')
        .filter(record => record.trim() !== '')
        .map(record => 'MSH' + record.trim());
};

export {
    loadCSVData,
    getAge,
    groupHL7Records
}