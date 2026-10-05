// Paginile CRM-ului (tema deschisă/întunecată se aplică doar aici).
export const CRM_PATH = /^\/(admin|teacher|login)(\/|$)/

export const isCrmPath = (pathname) => CRM_PATH.test(pathname || '')
