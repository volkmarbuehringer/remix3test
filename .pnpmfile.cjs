module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === 'remix-the-web') {
        delete pkg.scripts.postinstall
      }
      return pkg
    },
  },
}
