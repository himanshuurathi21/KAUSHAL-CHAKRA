/**
 * Quiz bank for skill verification.
 * Each entry: { q, options[4], answer (index), level }.
 * The `answer` is NEVER sent to the client (see publicQuestions).
 */
const BANK = {
  Python: [
    { q: 'What is the output of `print(2 ** 3)`?', options: ['6', '8', '9', '23'], answer: 1, level: 'BEGINNER' },
    { q: 'Which keyword defines a function in Python?', options: ['func', 'def', 'function', 'lambda-def'], answer: 1, level: 'BEGINNER' },
    { q: 'What does a list comprehension like `[x*x for x in range(5) if x % 2 == 0]` produce?', options: ['[0, 1, 4, 9, 16]', '[0, 4, 16]', '[1, 9]', 'A generator object'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'What is the difference between `==` and `is`?', options: ['No difference', '`==` compares values, `is` compares identity', '`is` compares values, `==` compares identity', '`is` is deprecated'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'What does the GIL prevent in CPython?', options: ['Memory leaks', 'True parallel execution of Python bytecode threads', 'Recursion', 'Importing C extensions'], answer: 1, level: 'EXPERT' },
    { q: 'When is `__slots__` worth using in a class?', options: ['Always, for speed', 'To restrict attribute creation and cut per-instance memory overhead', 'To make methods static', 'To enable pickling'], answer: 1, level: 'EXPERT' },
  ],
  JavaScript: [
    { q: 'Which keyword declares a block-scoped variable?', options: ['var', 'let', 'dim', 'static'], answer: 1, level: 'BEGINNER' },
    { q: 'What does `typeof []` evaluate to?', options: ['"array"', '"object"', '"list"', '"undefined"'], answer: 1, level: 'BEGINNER' },
    { q: 'What is a closure?', options: ['A way to close the browser tab', 'A function that remembers variables from its outer scope', 'A type of loop', 'An error-handling block'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'What does `await` do inside an async function?', options: ['Blocks the whole browser', 'Pauses until the promise settles, then resumes', 'Cancels the promise', 'Runs code in parallel threads'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'Why does `console.log(0.1 + 0.2 === 0.3)` print false?', options: ['Bug in console.log', 'Binary floating-point cannot represent 0.1/0.2 exactly', '0.1 + 0.2 is 0.30000000000000004 only in strict mode', '=== also compares types of literals'], answer: 1, level: 'EXPERT' },
    { q: 'What is event-loop starvation typically caused by?', options: ['Too many setTimeout calls', 'Long synchronous work blocking the single thread', 'Using promises', 'Small heap size'], answer: 1, level: 'EXPERT' },
  ],
  Guitar: [
    { q: 'How many strings does a standard guitar have?', options: ['4', '5', '6', '7'], answer: 2, level: 'BEGINNER' },
    { q: 'Which of these is an open chord shape?', options: ['F barre', 'G major open', 'B minor barre', 'F# diminished'], answer: 1, level: 'BEGINNER' },
    { q: 'What does a capo do?', options: ['Mutes the strings', 'Raises the pitch by clamping across a fret', 'Tunes the guitar down', 'Amplifies the sound'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'In tab notation, what does "3h5" mean?', options: ['Fret 3 then fret 5 picked separately', 'Hammer-on from fret 3 to fret 5', 'Hold fret 3 for 5 beats', 'Harmonic on fret 3 and 5'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'What is the CAGED system used for?', options: ['String manufacturing', 'Mapping chord shapes and scales across the fretboard', 'Amplifier settings', 'Counting rhythm'], answer: 1, level: 'EXPERT' },
    { q: 'Which scale fits naturally over a ii–V–I in C major?', options: ['C minor pentatonic', 'D Dorian / G Mixolydian / C Ionian', 'C harmonic minor throughout', 'Whole-tone scale'], answer: 1, level: 'EXPERT' },
  ],
  Photography: [
    { q: 'What does ISO control?', options: ['Aperture size', 'Sensor sensitivity to light', 'Shutter speed', 'Focal length'], answer: 1, level: 'BEGINNER' },
    { q: 'A wide aperture like f/1.8 gives you…', options: ['Everything in focus', 'A blurry background (shallow depth of field)', 'A darker image always', 'A wider angle of view'], answer: 1, level: 'BEGINNER' },
    { q: 'What is the rule of thirds?', options: ['Shoot only 3 photos', 'Place key elements along grid lines/intersections', 'Use 1/3 shutter speed', 'Divide exposure into 3 brackets'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'Why shoot RAW instead of JPEG?', options: ['Smaller files', 'More editing latitude with uncompressed sensor data', 'Faster burst shooting always', 'No white balance needed'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'What causes chromatic aberration?', options: ['Dirty sensor', 'Lens failing to focus all wavelengths on one plane', 'High ISO noise', 'Slow memory card'], answer: 1, level: 'EXPERT' },
    { q: 'When is hyperfocal distance useful?', options: ['Portraits at f/1.4', 'Maximizing depth of field in landscapes', 'Freezing motion', 'Night astrophotography only'], answer: 1, level: 'EXPERT' },
  ],
  Piano: [
    { q: 'How many keys does a standard piano have?', options: ['76', '84', '88', '96'], answer: 2, level: 'BEGINNER' },
    { q: 'Which notes make up a C major triad?', options: ['C–D–G', 'C–E–G', 'C–F–A', 'C–Eb–G'], answer: 1, level: 'BEGINNER' },
    { q: 'What does the sustain (damper) pedal do?', options: ['Softens the tone', 'Lets notes ring after keys are released', 'Shifts the keyboard an octave', 'Locks the keys'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'What is a key signature with one sharp?', options: ['C major', 'G major / E minor', 'D major', 'F major'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'In figured-bass analysis, what does 6/4 under a bass note mean?', options: ['Second inversion triad', 'Root position', 'First inversion', 'A seventh chord'], answer: 0, level: 'EXPERT' },
    { q: 'Which practice method most improves fast passages?', options: ['Always playing at full speed', 'Slow, metronome-graded practice with rhythmic variation', 'Only playing hands together', 'Pedaling through mistakes'], answer: 1, level: 'EXPERT' },
  ],
  Spanish: [
    { q: 'How do you say "thank you" in Spanish?', options: ['Por favor', 'Gracias', 'Perdón', 'Salud'], answer: 1, level: 'BEGINNER' },
    { q: 'Which article goes with "libro" (book)?', options: ['la', 'el', 'los', 'las'], answer: 1, level: 'BEGINNER' },
    { q: 'Choose the correct form: "Ayer yo ___ al mercado."', options: ['voy', 'fui', 'iré', 'iba a ir'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'When do you use the subjunctive after "quiero que…"?', options: ['Never', 'To express a wish influencing another person', 'Only in the past', 'Only with ser/estar'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'What is the difference between "por" and "para" here: "Estudio ___ ser médico"?', options: ['Both work', '"para" — purpose/destination', '"por" — purpose', 'Neither; use "a"'], answer: 1, level: 'EXPERT' },
    { q: 'Which sentence uses the pluperfect subjunctive correctly?', options: ['Si tendría dinero, viajaría', 'Si hubiera tenido dinero, habría viajado', 'Si tengo dinero, viajo', 'Si tendré dinero, viajo'], answer: 1, level: 'EXPERT' },
  ],
  Cooking: [
    { q: 'What does "sauté" mean?', options: ['Boil slowly', 'Cook quickly in a little hot fat', 'Bake covered', 'Freeze rapidly'], answer: 1, level: 'BEGINNER' },
    { q: 'Which knife is the all-purpose workhorse?', options: ['Paring knife', "Chef's knife", 'Bread knife', 'Cleaver'], answer: 1, level: 'BEGINNER' },
    { q: 'Why rest meat after cooking?', options: ['To cool it for handling', 'So juices redistribute instead of spilling out', 'To finish carryover seasoning', 'It is only tradition'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'What is the Maillard reaction?', options: ['Curdling of dairy', 'Browning between amino acids and sugars that builds flavor', 'Fermentation of dough', 'Emulsification of oil and water'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'A hollandaise breaks (splits). What is the standard rescue?', options: ['Add cold water', 'Whisk in a spoon of hot water or a fresh yolk', 'Add more butter fast', 'Chill it immediately'], answer: 1, level: 'EXPERT' },
    { q: 'Why calibrate sugar syrup stages by temperature, not color?', options: ['Color is more precise', 'Temperature maps reliably to sugar concentration/stage', 'Thermometers are cheaper', 'Color changes after cooling only'], answer: 1, level: 'EXPERT' },
  ],
  Excel: [
    { q: 'What does the formula `=SUM(A1:A5)` do?', options: ['Counts the cells', 'Adds the values in A1 through A5', 'Averages the values', 'Finds the largest value'], answer: 1, level: 'BEGINNER' },
    { q: 'Which symbol starts every formula?', options: ['#', '=', '@', '$'], answer: 1, level: 'BEGINNER' },
    { q: 'What does VLOOKUP do?', options: ['Looks up a value vertically in a table range', 'Validates data types', 'Locks cells', 'Creates a chart'], answer: 0, level: 'INTERMEDIATE' },
    { q: 'What is the difference between `$A$1` and `A1` in a formula?', options: ['No difference', 'Absolute vs relative reference when copying', 'One is a text label', 'One works only in tables'], answer: 1, level: 'INTERMEDIATE' },
    { q: 'Why would you prefer INDEX+MATCH over VLOOKUP?', options: ['It is always faster to type', 'Looks left, survives column inserts, exact-match by default', 'It works without a table', 'It ignores errors'], answer: 1, level: 'EXPERT' },
    { q: 'What does a PivotTable do?', options: ['Rotates text', 'Summarizes and regroups large datasets dynamically', 'Fixes broken formulas', 'Merges workbooks'], answer: 1, level: 'EXPERT' },
  ],
};

/** Quiz questions for a skill (with answers — server side only), or null. */
function getQuiz(skillName) {
  return BANK[skillName] || null;
}

function hasQuiz(skillName) {
  return Object.hasOwn(BANK, skillName);
}

function quizSkillNames() {
  return Object.keys(BANK);
}

module.exports = { getQuiz, hasQuiz, quizSkillNames };
