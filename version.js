// Follows Semantic Versioning 2.0.0 (https://semver.org/spec/v2.0.0.html).
const version = {
    major: '0',
    minor: '4',
    patch: '0',
    prerelease: 'alpha',
    build: new Date().toISOString().split('T')[0].replaceAll('-', ''),
    semver: '',
};

version.semver += `${version.major}.${version.minor}.${version.patch}`
version.semver += `${version.prerelease && `-${version.prerelease}+${version.build}`}`
