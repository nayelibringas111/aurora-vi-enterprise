def test_health(client):
    assert client.get("/health").json()["status"] == "ok"


def test_login_ok_and_fail(client):
    assert client.post("/api/auth/login", json={"email": "admin@auroravi.com", "password": "mala"}).status_code == 401
    r = client.post("/api/auth/login", json={"email": "admin@auroravi.com", "password": "Admin123!"})
    assert r.status_code == 200 and r.json()["user"]["role"] == "admin"


def test_protected_requires_token(client):
    assert client.get("/api/customers").status_code == 401


def test_role_permissions(client, almacen, vendedor):
    assert client.get("/api/analytics/overview", headers=almacen).status_code == 403
    assert client.get("/api/analytics/overview", headers=vendedor).status_code == 403
    assert client.get("/api/products", headers=almacen).status_code == 200
    assert client.get("/api/users", headers=vendedor).status_code == 403


def test_sale_updates_inventory_and_audit(client, admin):
    prod = client.get("/api/products?q=Arroz", headers=admin).json()["items"][0]
    before = prod["stock"]
    r = client.post("/api/sales", headers=admin, json={
        "payment_method": "tarjeta", "items": [{"product_id": prod["id"], "quantity": 2, "discount_pct": 10}],
    })
    assert r.status_code == 201, r.text
    sale = r.json()
    assert sale["status"] == "completada"
    gross = prod["price"] * 2
    assert sale["subtotal"] == round(gross * 0.9, 2)
    assert sale["tax"] == round(sale["subtotal"] * 0.18, 2)
    assert sale["total"] == round(sale["subtotal"] + sale["tax"], 2)
    after = client.get("/api/products?q=Arroz", headers=admin).json()["items"][0]["stock"]
    assert after == before - 2
    logs = client.get("/api/audit?action=sale.create", headers=admin).json()
    assert any(l["entity_id"] == str(sale["id"]) for l in logs)

    c = client.post(f"/api/sales/{sale['id']}/cancel", headers=admin)
    assert c.status_code == 200 and c.json()["status"] == "anulada"
    restored = client.get("/api/products?q=Arroz", headers=admin).json()["items"][0]["stock"]
    assert restored == before
    assert client.post(f"/api/sales/{sale['id']}/cancel", headers=admin).status_code == 409


def test_insufficient_stock_rejected(client, admin):
    prod = client.get("/api/products?q=Licuadora", headers=admin).json()["items"][0]
    r = client.post("/api/sales", headers=admin, json={
        "items": [{"product_id": prod["id"], "quantity": 9999}],
    })
    assert r.status_code == 409 and "Stock insuficiente" in r.json()["detail"]


def test_order_then_confirm(client, admin):
    prod = client.get("/api/products?q=Azúcar", headers=admin).json()["items"][0]
    r = client.post("/api/sales", headers=admin, json={
        "confirm": False, "items": [{"product_id": prod["id"], "quantity": 1}],
    })
    assert r.json()["status"] == "pedido"
    stock_pending = client.get("/api/products?q=Azúcar", headers=admin).json()["items"][0]["stock"]
    assert stock_pending == prod["stock"]
    ok = client.post(f"/api/sales/{r.json()['id']}/confirm", headers=admin)
    assert ok.json()["status"] == "completada"


def test_customer_crud_and_duplicate(client, admin):
    body = {"doc_type": "DNI", "doc_number": "99887766", "name": "Cliente Prueba", "email": "prueba@ejemplo.pe", "segment": "Minorista"}
    r = client.post("/api/customers", headers=admin, json=body)
    assert r.status_code == 201
    assert client.post("/api/customers", headers=admin, json=body).status_code == 409
    bad = client.post("/api/customers", headers=admin, json={**body, "doc_number": "1", "email": "x"})
    assert bad.status_code == 422


def test_dashboard_and_analytics(client, admin):
    d = client.get("/api/dashboard/summary?days=90", headers=admin).json()
    assert d["kpis"]["transactions"] > 0 and d["kpis"]["revenue"] > 0
    ov = client.get("/api/analytics/overview", headers=admin).json()
    assert ov["compare"]["mean"] > 0 and ov["histogram"]
    v = client.get("/api/analytics/variables/metodo_pago", headers=admin).json()
    assert v["classification"]["label"] == "Cualitativa nominal"
    u = client.get("/api/analytics/variables/unidades_por_venta", headers=admin).json()
    assert u["classification"]["subtype"] == "discreta" and u["pmf"]


def test_statistics_endpoints(client, admin):
    r = client.post("/api/statistics/mean", headers=admin, json={"values": [10, 20, 30]})
    assert r.json()["mean"] == 20
    r = client.post("/api/statistics/median", headers=admin, json={"values": [1, 2, 3, 4]})
    assert r.json()["median"] == 2.5
    r = client.post("/api/statistics/compare", headers=admin, json={"variable": "monto_venta"})
    assert r.status_code == 200 and r.json()["mean"] > 0
    assert client.post("/api/statistics/mean", headers=admin, json={}).status_code == 422
    hist = client.get("/api/statistics/history", headers=admin).json()
    assert hist["analyses"]


def test_bayes_endpoints(client, admin):
    r = client.post("/api/probability/bayes", headers=admin,
                    json={"prior": 0.01, "likelihood": 0.99, "false_positive": 0.05})
    assert round(r.json()["posterior"], 4) == 0.1667
    e = client.post("/api/probability/bayes/empirical", headers=admin,
                    json={"threshold": 150, "payment_method": "tarjeta"})
    assert e.status_code == 200 and 0 <= e.json()["posterior"] <= 1


def test_random_variable_and_probability(client, admin):
    r = client.post("/api/random-variables/analyze", headers=admin, json={"variable": "unidades_por_venta"})
    assert r.json()["kind"] == "discreta"
    p = client.post("/api/probability/event", headers=admin, json={"variable": "monto_venta", "op": "ge", "threshold": 100})
    assert 0 < p.json()["probability"] < 1


def test_insights_and_reports(client, admin):
    ins = client.post("/api/insights/generate", headers=admin).json()
    assert ins and all(i["evidence"] is not None for i in ins)
    assert client.get("/api/insights", headers=admin).json()
    rep = client.get("/api/reports?kind=estadistico", headers=admin).json()
    assert rep["columns"] and rep["rows"]
    csv = client.get("/api/reports?kind=productos&format=csv", headers=admin)
    assert csv.headers["content-type"].startswith("text/csv")
    assert client.get("/api/reports?kind=nada", headers=admin).status_code == 422


def test_vendedor_sees_only_own_sales(client, vendedor, admin):
    mine = client.get("/api/sales?limit=500", headers=vendedor).json()
    allsales = client.get("/api/sales?limit=500", headers=admin).json()
    assert 0 < mine["total"] < allsales["total"]
