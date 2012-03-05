exports.config = {
  port: 80,
  redirect: {
    'libredocs.nodejitsu.com': 'http://libredocs.org',
    'www.libredocs.org': 'http://libredocs.org',
    'www.libredoc.org': 'http://libredocs.org',
    'libredoc.org': 'http://libredocs.org'
  },
  host: {
    'libredocs.org': '/static',
    'mich.libredocs.org': '/static',
    'libredocs.local': '/static'
  },
  handler: {
    'proxy.libredocs.org': './proxy',
    'proxy.libredocs.local': './proxy'
  },
  pathHandler: {
    'libredocs.org/users': './users',
    'libredocs.org/useraddress': './useraddress',
    'libredocs.org/userExists': './userExists',
    'libredocs.org/browserid-verifier': './browserid',
    'libredocs.org/provision': './provision',
    'libredocs.org/squat': './squat',
    'libredocs.org/createDb': './createDb',
    'libredocs.org/setConfig': './setConfig',
    'libredocs.org/storeBearerToken': './storeBearerToken',
    'libredocs.local/users': './users',
    'libredocs.local/browserid-verifier': './browserid',
    'libredocs.local/provision': './provision',
    'libredocs.local/squat': './squat',
    'libredocs.local/createDb': './createDb',
    'libredocs.local/setConfig': './setConfig',
    'libredocs.local/storeBearerToken': './storeBearerToken'
  }
};
