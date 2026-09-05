const ops = ['addition', 'subtraction', 'multiplication', 'division', 'square', 'cube', 'squareRoot', 'tables', 'random'];

function getRandomNumber(digits, allowDecimals) {
    const min = Math.pow(10, digits - 1);
    const max = Math.pow(10, digits) - 1;
    let num = Math.floor(Math.random() * (max - min + 1)) + min;
    
    if (allowDecimals && Math.random() > 0.5) {
        num = +(num + Math.random()).toFixed(2);
    }
    return num;
}

function generateOptions(correctAnswer) {
    const options = new Set([correctAnswer.toString()]);
    let iters = 0;
    while(options.size < 4) {
        iters++;
        if (iters > 1000) throw new Error("INFINITE LOOP IN generateOptions for answer: " + correctAnswer);
        
        const offset = (Math.random() * 20 - 10);
        let wrong = correctAnswer + offset;
        
        if (Number.isInteger(correctAnswer)) {
            wrong = Math.floor(wrong);
        } else {
            wrong = +(wrong.toFixed(2));
        }
        
        if (wrong !== correctAnswer && wrong > 0) {
            options.add(wrong.toString());
        }
    }
    return Array.from(options);
}

// Test what happens if correctAnswer is very large or very small or negative
try {
    generateOptions(0); // what if answer is 0?
    console.log("0 passed");
    generateOptions(-5); // what if answer is negative? 
    console.log("-5 passed");
} catch (e) {
    console.log(e);
}
