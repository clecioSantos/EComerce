// Stub de `next/headers` para testes de integração (fora do runtime do Next).
export async function headers(): Promise<Headers> {
  return new Headers();
}

export async function cookies() {
  const store = new Map<string, string>();
  return {
    get: (name: string) => {
      const value = store.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      store.set(name, value);
    },
    delete: (name: string) => {
      store.delete(name);
    },
  };
}
