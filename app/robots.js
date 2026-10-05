// Aplicație internă: nimic nu se indexează.
export default function robots() {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
  }
}
