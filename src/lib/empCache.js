// Module-level cache of employee objects, keyed by id. Persists across
// client-side navigations within the DA section (list -> dashboard -> edit/
// expenses/documents/salary) so a page that was just fetched by the list
// doesn't have to re-fetch from scratch and show a loading flash — it seeds
// its initial state from here, then still refreshes from the network in the
// background to stay correct.
const cache = new Map()

export function setEmp(emp) { if (emp?.id) cache.set(emp.id, emp) }
export function setEmps(emps) { (emps || []).forEach(setEmp) }
export function getEmp(id) { return cache.get(id) || null }
