// One password policy for every place a password is set (register, change, admin create and reset, scripts).
// The browser mirrors the cheap rules in src/components/account/styles.ts; this module is the authority.
const STAFF_ROLES = ['teacher', 'admin'];
const MIN_LENGTH = { student: 8, staff: 12 };
const MAX_BYTES = 72; // bcrypt ignores everything after 72 bytes

// Passwords that appear at the top of public breach lists, plus words specific to this app.
// Matching is done on a normalised form, so "Password1", "P@ssw0rd!" and "pAssWord123" are all caught by "password".
const COMMON = new Set(`
password passw0rd pass pa55word p4ssword passwort passwd pword secret letmein welcome login admin administrator root toor guest user
qwerty qwertyuiop qwerty123 qwertyui asdfgh asdfghjkl asdf zxcvbn zxcvbnm azerty qazwsx qazwsxedc 1qaz2wsx 1q2w3e 1q2w3e4r
iloveyou iloveu loveyou love lover monkey dragon master shadow sunshine princess football baseball basketball soccer hockey
superman batman spiderman pokemon naruto starwars matrix hello hello123 freedom whatever trustno1 abc123 abcd1234 abcdefgh abcdef
michael jennifer jessica ashley daniel thomas robert charlie joshua matthew andrew jordan hunter buster tigger summer winter spring
autumn monday friday sunday computer internet google facebook youtube twitter instagram snapchat whatsapp tiktok netflix amazon apple
samsung nokia ranger harley mustang ferrari porsche mercedes toyota honda yamaha liverpool chelsea arsenal manchester barcelona
madrid juventus cowboys yankees lakers steelers eagles hallo salasana motdepasse contrasena senha
changeme change123 default test tester testing test123 temp temporary temp123 demo sample example user123 admin123 root123
welcome1 welcome123 passw0rd1 letmein123 monkey123 dragon123 master123 qwe123 qweasd qweasdzxc zaq12wsx zaq1zaq1 mypassword mypass
mypassword123 password123 password1234 passwordpassword mypassw0rd newpassword newpass oldpassword secret123 secretpassword
anatolearn anatolearn123 anatomy anatomy123 anatomical physiotherapy physio nursing student teacher teacher123 student123
school school123 sit singapore singapore123 singaporetech sitsingapore university college class classroom learning learn
`.split(/\s+/).filter(Boolean));

// Keyboard rows and sequences: a password made of one of these (or a slice of it, 6+ characters) is guessable.
const SEQUENCES = ['abcdefghijklmnopqrstuvwxyz', 'zyxwvutsrqponmlkjihgfedcba', '0123456789', '9876543210', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm',
  '1qaz2wsx3edc4rfv', 'qazwsxedcrfv', 'poiuytrewq', 'lkjhgfdsa', 'mnbvcxz'];

const LEET = { 0: 'o', 1: 'l', 3: 'e', 4: 'a', 5: 's', 7: 't', 8: 'b', 9: 'g', '@': 'a', $: 's', '!': 'i', '+': 't' };

// Lowercase, undo common character swaps and drop trailing digits or symbols ("Summer2024!" -> "summer").
function normalise(password) {
  const lower = password.toLowerCase();
  const stripped = lower.replace(/[\d\s!@#$%^&*()_+=.,?\-]+$/, '').replace(/^[\d\s!@#$%^&*()_+=.,?\-]+/, '');
  return {
    exact: lower.replace(/[\s\-_.]/g, ''),
    stripped: stripped.replace(/[\s\-_.]/g, ''),
    leet: [...stripped].map((char) => LEET[char] ?? char).join('').replace(/[\s\-_.]/g, ''),
    leetFull: [...lower].map((char) => LEET[char] ?? char).join('').replace(/[\s\-_.]/g, '').replace(/[\d!@#$%^&*()_+=.,?]+$/, ''),
  };
}

const inCommonList = (text) => Object.values(normalise(text)).some((form) => form.length > 0 && COMMON.has(form));

function isCommon(password) {
  if (inCommonList(password)) return true;
  // The same unit repeated ("Password1Password1", "abcabcabcabc").
  const unit = password.toLowerCase().match(/^(.+?)\1+$/)?.[1];
  if (unit && (unit.length <= 3 || inCommonList(unit))) return true;
  // Barely any variety ("Aaaaaaa1A") is guessable however long it is.
  if (password.length < 16 && new Set(password.toLowerCase()).size < 5) return true;
  const lower = password.toLowerCase();
  return SEQUENCES.some((sequence) => {
    for (let size = 6; size <= sequence.length; size += 1)
      for (let start = 0; start + size <= sequence.length; start += 1)
        if (lower.includes(sequence.slice(start, start + size)) && lower.length - size <= 3) return true;
    return false;
  });
}

// Personal details make a password guessable even when it looks random.
function containsPersonalDetail(password, { email, name } = {}) {
  const lower = password.toLowerCase();
  const tokens = new Set();
  if (typeof email === 'string') {
    const local = email.toLowerCase().split('@')[0];
    tokens.add(local);
    for (const part of local.split(/[^a-z0-9]+/)) tokens.add(part);
  }
  if (typeof name === 'string') for (const part of name.toLowerCase().split(/[^a-z0-9]+/)) tokens.add(part);
  return [...tokens].some((token) => token.length >= 4 && lower.includes(token));
}

const minimumLength = (role) => (STAFF_ROLES.includes(role) ? MIN_LENGTH.staff : MIN_LENGTH.student);

// Returns a message describing the first problem, or null if the password is acceptable.
function passwordProblem(password, { role = 'student', email, name } = {}) {
  if (typeof password !== 'string') return 'A password is required';
  const min = minimumLength(role);
  if (password.length < min) return `Password must be at least ${min} characters${min > MIN_LENGTH.student ? ' for teachers and administrators' : ''}`;
  if (Buffer.byteLength(password) > MAX_BYTES) return 'Password must be 72 bytes or fewer';
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return 'Password must contain at least one uppercase letter and one number';
  if (isCommon(password)) return 'That password is too common or easy to guess. Choose something less predictable, such as three or four unrelated words.';
  if (containsPersonalDetail(password, { email, name })) return 'Password must not contain your name or email address';
  return null;
}

module.exports = { passwordProblem, minimumLength, isCommon, STAFF_ROLES };
