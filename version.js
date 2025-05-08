// Follows Semantic Versioning 2.0.0 (https://semver.org/spec/v2.0.0.html).
import {SCRIPT_PROCESSED} from './strings.js';

export const version = {
    major: '0',
    minor: '4',
    patch: '0',
    prerelease: 'alpha',
    build: new Date().toISOString().split('T')[0].replaceAll('-', ''),
    toString () {
        return `${this.major}.${this.minor}.${this.patch}${this.isPrerelease() && `-${this.prerelease}+${this.build}`}`;
    },
    isPrerelease () {
        return Boolean(this.prerelease);
    },
};

console.info(SCRIPT_PROCESSED('Version'));
