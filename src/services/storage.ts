import { PostcardData } from '../types'

const DB_NAME = 'postcard-app'
const DB_VERSION = 1
const STORE_NAME = 'postcards'

export class PostcardStorage {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    if (this.db) return

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'))
      }

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('createdAt', 'createdAt', { unique: false })
          store.createIndex('postalCode', 'postalCode', { unique: false })
          store.createIndex('address', 'address', { unique: false })
        }
      }
    })
  }

  async add(data: Omit<PostcardData, 'id'>): Promise<string> {
    if (!this.db) await this.init()

    const id = `postcard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const postcard: PostcardData = {
      ...data,
      id,
      createdAt: data.createdAt || Date.now()
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(postcard)

      request.onerror = () => {
        reject(new Error('Failed to add postcard'))
      }

      request.onsuccess = () => {
        resolve(id)
      }
    })
  }

  async update(id: string, data: Partial<PostcardData>): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      const getRequest = store.get(id)
      getRequest.onsuccess = () => {
        const postcard = getRequest.result
        if (!postcard) {
          reject(new Error('Postcard not found'))
          return
        }

        const updated = { ...postcard, ...data, id }
        const updateRequest = store.put(updated)

        updateRequest.onerror = () => {
          reject(new Error('Failed to update postcard'))
        }

        updateRequest.onsuccess = () => {
          resolve()
        }
      }

      getRequest.onerror = () => {
        reject(new Error('Failed to fetch postcard'))
      }
    })
  }

  async delete(id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onerror = () => {
        reject(new Error('Failed to delete postcard'))
      }

      request.onsuccess = () => {
        resolve()
      }
    })
  }

  async getAll(): Promise<PostcardData[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onerror = () => {
        reject(new Error('Failed to fetch all postcards'))
      }

      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  async getById(id: string): Promise<PostcardData | null> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(id)

      request.onerror = () => {
        reject(new Error('Failed to fetch postcard'))
      }

      request.onsuccess = () => {
        resolve(request.result || null)
      }
    })
  }

  async queryByPostalCode(postalCode: string): Promise<PostcardData[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('postalCode')
      const request = index.getAll(postalCode)

      request.onerror = () => {
        reject(new Error('Failed to query by postal code'))
      }

      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  async queryByAddress(address: string): Promise<PostcardData[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('address')
      const request = index.getAll(address)

      request.onerror = () => {
        reject(new Error('Failed to query by address'))
      }

      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }

  async search(query: string): Promise<PostcardData[]> {
    if (!this.db) await this.init()

    const allCards = await this.getAll()
    const lowerQuery = query.toLowerCase()

    return allCards.filter(card =>
      card.name.toLowerCase().includes(lowerQuery) ||
      card.address.toLowerCase().includes(lowerQuery) ||
      card.postalCode?.includes(query) ||
      card.message.toLowerCase().includes(lowerQuery)
    )
  }

  async bulkInsert(data: Omit<PostcardData, 'id'>[]): Promise<string[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const ids: string[] = []
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      data.forEach(item => {
        const id = `postcard-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const postcard: PostcardData = {
          ...item,
          id,
          createdAt: item.createdAt || Date.now()
        }
        ids.push(id)
        store.add(postcard)
      })

      transaction.onerror = () => {
        reject(new Error('Failed to bulk insert postcards'))
      }

      transaction.oncomplete = () => {
        resolve(ids)
      }
    })
  }

  async bulkDelete(ids: string[]): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      ids.forEach(id => {
        store.delete(id)
      })

      transaction.onerror = () => {
        reject(new Error('Failed to bulk delete postcards'))
      }

      transaction.oncomplete = () => {
        resolve()
      }
    })
  }

  async clear(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onerror = () => {
        reject(new Error('Failed to clear postcards'))
      }

      request.onsuccess = () => {
        resolve()
      }
    })
  }

  async count(): Promise<number> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.count()

      request.onerror = () => {
        reject(new Error('Failed to count postcards'))
      }

      request.onsuccess = () => {
        resolve(request.result)
      }
    })
  }
}

export const storage = new PostcardStorage()
