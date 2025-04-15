// Follows Semantic Versioning 2.0.0 (https://semver.org/spec/v2.0.0.html).
import { LOG } from './strings.js';
export const version = {
    major: '0',
    minor: '2',
    patch: '0',
    prerelease: 'alpha',
    build: new Date().toISOString().split('T')[0].replaceAll('-', ''),
    toString () {
        return `${this.major}.${this.minor}.${this.patch}${this.prerelease && `-${this.prerelease}+${this.build}`}`;
    },
};


console.info(LOG.SCRIPT_PROCESSED('Version'));  // eslint-disable-line new-cap
