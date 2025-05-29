const { translateEnglishToRobo } = require('./robot_translator.js');

const tests = [
    'to plant flowers',
    'plant in the garden',
    'the plant is growing',
    'i will plant the seed',
    'plant the plant',
    'water the plant',
    'plant and water'
];

console.log('Testing translator with various examples:\n');
tests.forEach(test => {
    const result = translateEnglishToRobo(test);
    console.log(`Input:  "${test}"`);
    console.log(`Output: "${result}"\n`);
}); 