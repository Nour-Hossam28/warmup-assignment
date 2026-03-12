const fs = require("fs");

const DELIVERY_START = 8 * 3600; 
const DELIVERY_END = 22 * 3600;  

function parseAmPmToSec(t){
    let [time, period] = t.trim().split(' ');
    let [h, m, s] = time.split(':').map(Number);

    if (period === 'am') {
        if (h === 12) h = 0;
    } else {
        if (h !== 12) h += 12;
    }

    return h * 3600 + m * 60 + s;
}

function durationToSec(t){
    let [h,m,s] = t.split(":").map(Number);
    return h*3600 + m*60 + s;
}

function secToDuration(sec){
    let h = Math.floor(sec/3600);
    let m = Math.floor((sec%3600)/60);
    let s = sec%60;

    return h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
}
// ============================================================
// Function 1: getShiftDuration(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getShiftDuration(startTime, endTime) {
    function toSeconds(t) {
        let [time, period] = t.trim().split(' '); //hena the trim removes the extra space
        // the .split it splits the string 3and el space so it becomes 
        // [3:30:12, am] and the time="3:30:12" and period= "am"
        let [h, m, s] = time.split(':').map(Number); //hena we extract
        //  the h,m,s and .map(num) dy converts string to numbers
        if (period === 'am') {
            if (h === 12) h = 0;   // if its 12 am
        } else {                       //else its pm
            if (h !== 12) h += 12;   //here 12 pm hatfdal as it is not 24
        }
        return h * 3600 + m * 60 + s;
    }

    let diff = toSeconds(endTime) - toSeconds(startTime);
    if (diff < 0) diff += 24 * 3600;  //shift mekmel after midnight 
    let h   = Math.floor(diff / 3600); //.floor rounds down an int
    let m   = Math.floor((diff % 3600) / 60);
    let s   = diff % 60;

    return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
    //.padStart puts a zero law single digit and the 2 means string
    //should be two characters long at least
}

// ============================================================
// Function 2: getIdleTime(startTime, endTime)
// startTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// endTime: (typeof string) formatted as hh:mm:ss am or hh:mm:ss pm
// Returns: string formatted as h:mm:ss
// ============================================================
function getIdleTime(startTime, endTime) {
let start = parseAmPmToSec(startTime);
    let end   = parseAmPmToSec(endTime);
    let idle  = 0;
     if (start < DELIVERY_START) {
        idle += Math.min(DELIVERY_START, end) - start;
    }
    if (end > DELIVERY_END) {
        idle += end - Math.max(DELIVERY_END, start);
    }

    return secToDuration(idle);
}

// ============================================================
// Function 3: getActiveTime(shiftDuration, idleTime)
// shiftDuration: (typeof string) formatted as h:mm:ss
// idleTime: (typeof string) formatted as h:mm:ss
// Returns: string formatted as h:mm:ss
// ============================================================
function getActiveTime(shiftDuration, idleTime) {
    return secToDuration(durationToSec(shiftDuration) - durationToSec(idleTime));
}

// ============================================================
// Function 4: metQuota(date, activeTime)
// date: (typeof string) formatted as yyyy-mm-dd
// activeTime: (typeof string) formatted as h:mm:ss
// Returns: boolean
// ============================================================
function metQuota(date, activeTime) {
   let [y, mo, d] = date.split("-").map(Number);
    let isEid = (y === 2025 && mo === 4 && d >= 10 && d <= 30);
    let quota = isEid ? 6 * 3600 : 8 * 3600 + 24 * 60;

    return durationToSec(activeTime) >= quota;
}

// ============================================================
// Function 5: addShiftRecord(textFile, shiftObj)
// textFile: (typeof string) path to shifts text file
// shiftObj: (typeof object) has driverID, driverName, date, startTime, endTime
// Returns: object with 10 properties or empty object {}
// ============================================================
function addShiftRecord(textFile, shiftObj) {
     let { driverID, driverName, date, startTime, endTime } = shiftObj;
    let raw      = fs.readFileSync(textFile, { encoding: "utf8" });
    let lines    = raw.split("\n");
    let header   = lines[0];
    let dataLines = lines.slice(1).filter(l => l.trim() !== "");

    for (let line of dataLines) {
        let cols = line.split(",");
        if (cols[0] === driverID && cols[2] === date) {
            return {};
        }
    }

    let shiftDuration = getShiftDuration(startTime, endTime);
    let idleTime      = getIdleTime(startTime, endTime);
    let activeTime    = getActiveTime(shiftDuration, idleTime);
    let quota         = metQuota(date, activeTime);

    let newRecord = {
        driverID, driverName, date,
        startTime, endTime,shiftDuration, idleTime,
        activeTime,metQuota: quota,
        hasBonus: false          
    };

    let newLine = [
        driverID, driverName, date, startTime, endTime,
        shiftDuration, idleTime, activeTime, quota, false
    ].join(",");

    let lastDriverIdx = -1;
    for (let i = 0; i < dataLines.length; i++) {
        if (dataLines[i].split(",")[0] === driverID) lastDriverIdx = i;
    }

    if (lastDriverIdx === -1) {
        dataLines.push(newLine);     
    } else {
        dataLines.splice(lastDriverIdx + 1, 0, newLine); 
    }
    fs.writeFileSync(
        textFile,
        header + "\n" + dataLines.join("\n"),
        { encoding: "utf8" }
    );

    return newRecord
}

// ============================================================
// Function 6: setBonus(textFile, driverID, date, newValue)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// date: (typeof string) formatted as yyyy-mm-dd
// newValue: (typeof boolean)
// Returns: nothing (void)
// ============================================================
function setBonus(textFile, driverID, date, newValue) {
let raw   = fs.readFileSync(textFile, { encoding: "utf8" });
    let lines = raw.split("\n");

    for (let i = 0; i < lines.length; i++) {
        let cols = lines[i].split(",");

        if (cols[0] === driverID && cols[2] === date) {
            cols[9] = String(newValue);   // overwrite hasBonus with "true" or "false"
            lines[i] = cols.join(",");    
            break;                        
        }
    }

    fs.writeFileSync(textFile, lines.join("\n"), { encoding: "utf8" });}

// ============================================================
// Function 7: countBonusPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof string) formatted as mm or m
// Returns: number (-1 if driverID not found)
// ============================================================
function countBonusPerMonth(textFile, driverID, month) {
let raw       = fs.readFileSync(textFile, { encoding: "utf8" });
    let dataLines = raw.split("\n").slice(1).filter(l => l.trim() !== "");

    let monthNum = parseInt(month, 10);

    let driverExists = dataLines.some(l => l.split(",")[0] === driverID);
    if (!driverExists) return -1;

    let count = 0;
    for (let line of dataLines) {
        let cols      = line.split(",");
        let lineID    = cols[0];
        let lineMonth = parseInt(cols[2].split("-")[1], 10); // yyyy-mm-dd → mm → number
        let hasBonus  = cols[9].trim() === "true";           // trim guards \r on Windows

        if (lineID === driverID && lineMonth === monthNum && hasBonus) {
            count++;
        }
    }
    return count;}

// ============================================================
// Function 8: getTotalActiveHoursPerMonth(textFile, driverID, month)
// textFile: (typeof string) path to shifts text file
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getTotalActiveHoursPerMonth(textFile, driverID, month) {
    let raw       = fs.readFileSync(textFile, { encoding: "utf8" });
    let dataLines = raw.split("\n").slice(1).filter(l => l.trim() !== "");

    let total = 0;

    for (let line of dataLines) {
        let cols       = line.split(",");
        let lineID     = cols[0];
        let lineMonth  = parseInt(cols[2].split("-")[1], 10); // yyyy-mm-dd → month number
        let activeTime = cols[7].trim();                      

        if (lineID === driverID && lineMonth === month) {
            total += durationToSec(activeTime);
        }
    }

    return secToDuration(total);}

// ============================================================
// Function 9: getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month)
// textFile: (typeof string) path to shifts text file
// rateFile: (typeof string) path to driver rates text file
// bonusCount: (typeof number) total bonuses for given driver per month
// driverID: (typeof string)
// month: (typeof number)
// Returns: string formatted as hhh:mm:ss
// ============================================================
function getRequiredHoursPerMonth(textFile, rateFile, bonusCount, driverID, month) {
 let rateLines = fs.readFileSync(rateFile, { encoding: "utf8" })
                      .split("\n")
                      .filter(l => l.trim() !== "");
    let driverRate = rateLines.find(l => l.split(",")[0] === driverID);
    let dayOff     = driverRate.split(",")[1].trim(); // e.g. "Friday"

    const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

    let dataLines = fs.readFileSync(textFile, { encoding: "utf8" })
                      .split("\n").slice(1).filter(l => l.trim() !== "");

    let total = 0;
    for (let line of dataLines) {
        let cols      = line.split(",");
        let lineID    = cols[0];
        let date      = cols[2].trim();             // yyyy-mm-dd
        let lineMonth = parseInt(date.split("-")[1], 10);

        if (lineID !== driverID || lineMonth !== month) continue;

        let dayName = DAY_NAMES[new Date(date).getDay()];
        if (dayName === dayOff) continue;

        let [y, mo, d] = date.split("-").map(Number);
        let isEid = (y === 2025 && mo === 4 && d >= 10 && d <= 30);
        total += isEid ? 6 * 3600 : 8 * 3600 + 24 * 60;
    }
    total -= bonusCount * 2 * 3600;
    if (total < 0) total = 0;

    return secToDuration(total);}

// ============================================================
// Function 10: getNetPay(driverID, actualHours, requiredHours, rateFile)
// driverID: (typeof string)
// actualHours: (typeof string) formatted as hhh:mm:ss
// requiredHours: (typeof string) formatted as hhh:mm:ss
// rateFile: (typeof string) path to driver rates text file
// Returns: integer (net pay)
// ============================================================
function getNetPay(driverID, actualHours, requiredHours, rateFile) {
 let rateLines = fs.readFileSync(rateFile, { encoding: "utf8" })
                      .split("\n")
                      .filter(l => l.trim() !== "");
    let driverRate = rateLines.find(l => l.split(",")[0] === driverID);
    let cols    = driverRate.split(",");
    let basePay = parseInt(cols[2], 10);
    let tier    = parseInt(cols[3].trim(), 10);

    const TIER_ALLOWANCE = { 1: 50, 2: 20, 3: 10, 4: 3 };
    let allowedSec = TIER_ALLOWANCE[tier] * 3600;

    let actualSec   = durationToSec(actualHours);
    let requiredSec = durationToSec(requiredHours);

    if (actualSec >= requiredSec) return basePay;

    let missingSec = requiredSec - actualSec;

    let remainingSec = missingSec - allowedSec;
    if (remainingSec <= 0) return basePay;

    let billableHours = Math.floor(remainingSec / 3600);

    if (billableHours === 0) return basePay;
    let deductRate = Math.floor(basePay / 185);   // rounded down per spec
    let deduction  = billableHours * deductRate;

    return basePay - deduction;}

module.exports = {
    getShiftDuration,
    getIdleTime,
    getActiveTime,
    metQuota,
    addShiftRecord,
    setBonus,
    countBonusPerMonth,
    getTotalActiveHoursPerMonth,
    getRequiredHoursPerMonth,
    getNetPay
};
