// Unified data layer that switches between backend (auth) and localStorage (anonymous)
import * as Api from "@/lib/api";
import * as L from "@/lib/localStore";

export function makeStore(isAuth) {
  if (isAuth) {
    return {
      list: (kind) => Api.listSlots(kind),
      capacity: () => Api.slotCapacity(),
      create: (data) => Api.createSlot(data),
      update: (kind, id, patch) => Api.updateSlot(id, patch),
      remove: (kind, id) => Api.deleteSlot(id),
      unlock: (idx) => Api.unlockSlot(idx),
      exportData: (kind) => Api.exportSlots(kind),
      importData: (payload) => Api.importSlots(payload),
    };
  }
  return {
    list: async (kind) => L.localList(kind),
    capacity: async () => L.localCapacity(),
    create: async (data) => L.localCreate(data),
    update: async (kind, id, patch) => L.localUpdate(kind, id, patch),
    remove: async (kind, id) => L.localDelete(kind, id),
    unlock: async (idx) => L.localUnlock(idx),
    exportData: async (kind) => L.localExport(kind),
    importData: async (payload) => L.localImport(payload),
  };
}
