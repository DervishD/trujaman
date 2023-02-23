'use strict';

/* exported version DEBUG */

// Version of the PWA. Follows Semantic Versioning 2.0.0 (https://semver.org/spec/v2.0.0.html).
// const version = '0.1.0-alpha+20230220';
const version = {
    'major': '0',
    'minor': '1',
    'patch': '0',
    'prerelease': 'alpha',
    'build': '20230221',
    toString () {
        return `${this.major}.${this.minor}.${this.patch}` +
               `${this.prerelease && `-${this.prerelease}`}${this.build && `+${this.build}`}`;
    }
};

// Flag to indicate whether debug mode is enabled.
// The mode is enabled when the version code includes a prerelease identifier.
const DEBUG = Boolean(version.prerelease);
