class MockDocumentSnapshot:
    def __init__(self, id, data):
        self.id = id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data

class MockDocumentReference:
    def __init__(self, db, collection_name, doc_id):
        self.db = db
        self.collection_name = collection_name
        self.id = doc_id

    def get(self):
        data = self.db._data.get(self.collection_name, {}).get(self.id)
        return MockDocumentSnapshot(self.id, data)

    def set(self, data, merge=False):
        if self.collection_name not in self.db._data:
            self.db._data[self.collection_name] = {}
        if merge and self.id in self.db._data[self.collection_name]:
            self.db._data[self.collection_name][self.id].update(data)
        else:
            self.db._data[self.collection_name][self.id] = data

    def update(self, data):
        self.set(data, merge=True)

class MockCollectionReference:
    def __init__(self, db, name, _filters=None):
        self.db = db
        self.name = name
        self._filters = _filters or []

    def document(self, doc_id=None):
        import uuid
        doc_id = doc_id or str(uuid.uuid4())
        return MockDocumentReference(self.db, self.name, doc_id)

    def where(self, field, op, value):
        return MockCollectionReference(self.db, self.name, self._filters + [(field, op, value)])

    def limit(self, n):
        return self

    def stream(self):
        docs = self.db._data.get(self.name, {})
        for doc_id, data in docs.items():
            match = True
            for field, op, value in self._filters:
                doc_val = data.get(field)
                if op == "==" and doc_val != value: match = False
                elif op == "array_contains" and (not isinstance(doc_val, list) or value not in doc_val): match = False
            if match:
                yield MockDocumentSnapshot(doc_id, data)

class MockBatch:
    def __init__(self, db):
        self.db = db
        self.ops = []

    def set(self, ref, data):
        self.ops.append((ref, data))

    def update(self, ref, data):
        # Simplification: just merge on commit
        self.ops.append((ref, data))

    def commit(self):
        for ref, data in self.ops:
            ref.set(data)

class MockFirestoreDB:
    def __init__(self):
        self._data = {}

    def collection(self, name):
        return MockCollectionReference(self, name)

    def batch(self):
        return MockBatch(self)

    class ArrayUnion:
        def __init__(self, values):
            self.values = values

    class SERVER_TIMESTAMP:
        pass
