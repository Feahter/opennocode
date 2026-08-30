import { create } from 'zustand';
import * as storage from '../core/storage';
import type { App, Field, AppRecord, FieldType } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
  apps: App[];
  fields: Field[];
  selectedApp: App | null;
  records: AppRecord[];
  view: 'apps' | 'fields' | 'data' | 'uidemo';
  showModal: 'app' | 'field' | null;
  isLoading: boolean;
  
  // Actions
  init: () => Promise<void>;
  createApp: (name: string, description: string) => void;
  createField: (name: string, type: FieldType, label: string) => void;
  selectApp: (app: App) => void;
  createRecord: (data: Record<string, unknown>) => void;
  setView: (view: 'apps' | 'fields' | 'data' | 'uidemo') => void;
  setShowModal: (modal: 'app' | 'field' | null) => void;
  deleteApp: (id: string) => void;
  deleteField: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  apps: [],
  fields: [],
  selectedApp: null,
  records: [],
  view: 'apps',
  showModal: null,
  isLoading: true,

  init: async () => {
    await storage.initStorage();
    set({ 
      apps: storage.getApps(), 
      fields: storage.getFields(),
      isLoading: false 
    });
  },

  createApp: (name: string, description: string) => {
    const app: App = {
      id: uuidv4(),
      name,
      type: 'data',
      description,
      fields: [],
      views: [{ id: uuidv4(), type: 'table', name: '默认表格', config: {} }],
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    storage.createApp(app);
    set(state => ({ apps: [...state.apps, app], showModal: null }));
  },

  createField: (name: string, type: FieldType, label: string) => {
    const field: Field = {
      id: uuidv4(),
      name,
      type,
      meta: { label },
      permissions: [],
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    storage.createField(field);
    set(state => ({ fields: [...state.fields, field], showModal: null }));
  },

  selectApp: (app: App) => {
    set({ selectedApp: app, records: storage.getRecords(app.id), view: 'data' });
  },

  createRecord: (data: Record<string, unknown>) => {
    const { selectedApp } = get();
    if (!selectedApp) return;
    const record: AppRecord = {
      id: uuidv4(),
      app_id: selectedApp.id,
      data,
      created_by: 'user',
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    storage.createRecord(record);
    set(state => ({ records: [...state.records, record] }));
  },

  setView: (view) => set({ view }),
  setShowModal: (showModal) => set({ showModal }),

  deleteApp: (id: string) => {
    storage.deleteApp(id);
    set(state => ({ 
      apps: state.apps.filter(a => a.id !== id),
      selectedApp: state.selectedApp?.id === id ? null : state.selectedApp 
    }));
  },

  updateApp: (id: string, updates: Partial<App>) => {
    storage.updateApp(id, updates);
    set(state => ({
      apps: state.apps.map(a => a.id === id ? { ...a, ...updates, updated_at: Date.now() } : a),
      selectedApp: state.selectedApp?.id === id ? { ...state.selectedApp, ...updates, updated_at: Date.now() } : state.selectedApp,
    }));
  },

  deleteField: (id: string) => {
    storage.deleteField(id);
    set(state => ({ fields: state.fields.filter(f => f.id !== id) }));
  },

  updateField: (id: string, updates: Partial<Field>) => {
    storage.updateField(id, updates);
    set(state => ({
      fields: state.fields.map(f => f.id === id ? { ...f, ...updates, updated_at: Date.now() } : f),
    }));
  },

  updateRecord: (id: string, updates: Partial<AppRecord>) => {
    storage.updateRecord(id, updates);
    set(state => ({
      records: state.records.map(r => r.id === id ? { ...r, ...updates, updated_at: Date.now() } : r),
    }));
  },

  deleteRecord: (id: string) => {
    storage.deleteRecord(id);
    set(state => ({ records: state.records.filter(r => r.id !== id) }));
  },
}));