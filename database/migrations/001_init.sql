-- Aurora VI Enterprise · esquema inicial PostgreSQL (Supabase)
-- Generado desde los modelos SQLAlchemy. Ejecutar una sola vez en el SQL Editor.
begin;

CREATE TABLE audit_logs (
	id SERIAL NOT NULL, 
	company_id INTEGER, 
	user_id INTEGER, 
	user_email VARCHAR(160), 
	action VARCHAR(40) NOT NULL, 
	entity VARCHAR(40), 
	entity_id VARCHAR(40), 
	detail JSON, 
	ip VARCHAR(45), 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);
CREATE INDEX ix_audit_logs_action ON audit_logs (action);
CREATE INDEX ix_audit_logs_company_id ON audit_logs (company_id);
CREATE INDEX ix_audit_logs_created_at ON audit_logs (created_at);

CREATE TABLE companies (
	id SERIAL NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	ruc VARCHAR(20), 
	currency VARCHAR(3) NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id)
);

CREATE TABLE roles (
	name VARCHAR(30) NOT NULL, 
	description VARCHAR(200) NOT NULL, 
	permissions JSON NOT NULL, 
	PRIMARY KEY (name)
);

CREATE TABLE categories (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_category_name UNIQUE (company_id, name), 
	FOREIGN KEY(company_id) REFERENCES companies (id)
);

CREATE TABLE customers (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	doc_type VARCHAR(10) NOT NULL, 
	doc_number VARCHAR(20) NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	email VARCHAR(160), 
	phone VARCHAR(30), 
	city VARCHAR(80), 
	segment VARCHAR(30) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_customer_doc UNIQUE (company_id, doc_number), 
	FOREIGN KEY(company_id) REFERENCES companies (id)
);
CREATE INDEX ix_customers_company_id ON customers (company_id);
CREATE INDEX ix_customers_name ON customers (name);

CREATE TABLE users (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	email VARCHAR(160) NOT NULL, 
	full_name VARCHAR(160) NOT NULL, 
	password_hash VARCHAR(100) NOT NULL, 
	role VARCHAR(30) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	last_login TIMESTAMP WITHOUT TIME ZONE, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(role) REFERENCES roles (name)
);
CREATE UNIQUE INDEX ix_users_email ON users (email);

CREATE TABLE bayes_analyses (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	hypothesis VARCHAR(200) NOT NULL, 
	evidence VARCHAR(200) NOT NULL, 
	prior NUMERIC(10, 8) NOT NULL, 
	likelihood NUMERIC(10, 8) NOT NULL, 
	marginal NUMERIC(10, 8) NOT NULL, 
	posterior NUMERIC(10, 8) NOT NULL, 
	source VARCHAR(20) NOT NULL, 
	detail JSON, 
	created_by INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);
CREATE INDEX ix_bayes_analyses_company_id ON bayes_analyses (company_id);

CREATE TABLE datasets (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	source VARCHAR(40) NOT NULL, 
	description VARCHAR(300), 
	row_count INTEGER NOT NULL, 
	filters JSON, 
	created_by INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);
CREATE INDEX ix_datasets_company_id ON datasets (company_id);

CREATE TABLE employees (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	user_id INTEGER, 
	full_name VARCHAR(160) NOT NULL, 
	position VARCHAR(80) NOT NULL, 
	branch VARCHAR(80) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);

CREATE TABLE products (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	category_id INTEGER, 
	sku VARCHAR(40) NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	price NUMERIC(12, 2) NOT NULL, 
	cost NUMERIC(12, 2) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_product_sku UNIQUE (company_id, sku), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(category_id) REFERENCES categories (id)
);
CREATE INDEX ix_products_category_id ON products (category_id);
CREATE INDEX ix_products_company_id ON products (company_id);
CREATE INDEX ix_products_name ON products (name);

CREATE TABLE random_variables (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	name VARCHAR(80) NOT NULL, 
	kind VARCHAR(12) NOT NULL, 
	definition JSON, 
	created_by INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);
CREATE INDEX ix_random_variables_company_id ON random_variables (company_id);

CREATE TABLE reports (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	kind VARCHAR(30) NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	params JSON, 
	row_count INTEGER NOT NULL, 
	created_by INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);
CREATE INDEX ix_reports_company_id ON reports (company_id);

CREATE TABLE dataset_variables (
	id SERIAL NOT NULL, 
	dataset_id INTEGER NOT NULL, 
	name VARCHAR(60) NOT NULL, 
	label VARCHAR(120) NOT NULL, 
	kind VARCHAR(40) NOT NULL, 
	unit VARCHAR(20), 
	PRIMARY KEY (id), 
	FOREIGN KEY(dataset_id) REFERENCES datasets (id)
);
CREATE INDEX ix_dataset_variables_dataset_id ON dataset_variables (dataset_id);

CREATE TABLE inventory (
	id SERIAL NOT NULL, 
	product_id INTEGER NOT NULL, 
	stock INTEGER NOT NULL, 
	min_stock INTEGER NOT NULL, 
	updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	UNIQUE (product_id), 
	FOREIGN KEY(product_id) REFERENCES products (id)
);

CREATE TABLE inventory_movements (
	id SERIAL NOT NULL, 
	product_id INTEGER NOT NULL, 
	type VARCHAR(12) NOT NULL, 
	quantity INTEGER NOT NULL, 
	balance INTEGER NOT NULL, 
	reason VARCHAR(200), 
	reference VARCHAR(40), 
	user_id INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(product_id) REFERENCES products (id), 
	FOREIGN KEY(user_id) REFERENCES users (id)
);
CREATE INDEX ix_inventory_movements_created_at ON inventory_movements (created_at);
CREATE INDEX ix_inventory_movements_product_id ON inventory_movements (product_id);

CREATE TABLE sales (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	number VARCHAR(20) NOT NULL, 
	customer_id INTEGER, 
	employee_id INTEGER, 
	branch VARCHAR(80) NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	subtotal NUMERIC(12, 2) NOT NULL, 
	discount NUMERIC(12, 2) NOT NULL, 
	tax NUMERIC(12, 2) NOT NULL, 
	total NUMERIC(12, 2) NOT NULL, 
	units INTEGER NOT NULL, 
	payment_method VARCHAR(20), 
	notes VARCHAR(300), 
	created_by INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	CONSTRAINT uq_sale_number UNIQUE (company_id, number), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(customer_id) REFERENCES customers (id), 
	FOREIGN KEY(employee_id) REFERENCES employees (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);
CREATE INDEX ix_sales_company_date ON sales (company_id, created_at);
CREATE INDEX ix_sales_customer_id ON sales (customer_id);
CREATE INDEX ix_sales_employee_id ON sales (employee_id);
CREATE INDEX ix_sales_status ON sales (status);

CREATE TABLE statistical_analyses (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	dataset_id INTEGER, 
	kind VARCHAR(40) NOT NULL, 
	variable VARCHAR(60), 
	params JSON, 
	sample_size INTEGER NOT NULL, 
	created_by INTEGER, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(dataset_id) REFERENCES datasets (id), 
	FOREIGN KEY(created_by) REFERENCES users (id)
);
CREATE INDEX ix_statistical_analyses_company_id ON statistical_analyses (company_id);
CREATE INDEX ix_statistical_analyses_created_at ON statistical_analyses (created_at);
CREATE INDEX ix_statistical_analyses_kind ON statistical_analyses (kind);

CREATE TABLE insights (
	id SERIAL NOT NULL, 
	company_id INTEGER NOT NULL, 
	analysis_id INTEGER, 
	rule_code VARCHAR(40) NOT NULL, 
	severity VARCHAR(10) NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	message TEXT NOT NULL, 
	evidence JSON, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(company_id) REFERENCES companies (id), 
	FOREIGN KEY(analysis_id) REFERENCES statistical_analyses (id)
);
CREATE INDEX ix_insights_company_id ON insights (company_id);
CREATE INDEX ix_insights_created_at ON insights (created_at);

CREATE TABLE observations (
	id SERIAL NOT NULL, 
	variable_id INTEGER NOT NULL, 
	row_index INTEGER NOT NULL, 
	value NUMERIC(14, 4) NOT NULL, 
	label VARCHAR(80), 
	PRIMARY KEY (id), 
	FOREIGN KEY(variable_id) REFERENCES dataset_variables (id)
);
CREATE INDEX ix_observations_variable_id ON observations (variable_id);

CREATE TABLE payments (
	id SERIAL NOT NULL, 
	sale_id INTEGER NOT NULL, 
	method VARCHAR(20) NOT NULL, 
	amount NUMERIC(12, 2) NOT NULL, 
	reference VARCHAR(60), 
	paid_at TIMESTAMP WITHOUT TIME ZONE DEFAULT now() NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sale_id) REFERENCES sales (id)
);
CREATE INDEX ix_payments_sale_id ON payments (sale_id);

CREATE TABLE sale_details (
	id SERIAL NOT NULL, 
	sale_id INTEGER NOT NULL, 
	product_id INTEGER NOT NULL, 
	quantity INTEGER NOT NULL, 
	unit_price NUMERIC(12, 2) NOT NULL, 
	discount NUMERIC(12, 2) NOT NULL, 
	line_total NUMERIC(12, 2) NOT NULL, 
	PRIMARY KEY (id), 
	FOREIGN KEY(sale_id) REFERENCES sales (id), 
	FOREIGN KEY(product_id) REFERENCES products (id)
);
CREATE INDEX ix_sale_details_product_id ON sale_details (product_id);
CREATE INDEX ix_sale_details_sale_id ON sale_details (sale_id);

CREATE TABLE statistical_results (
	id SERIAL NOT NULL, 
	analysis_id INTEGER NOT NULL, 
	metric VARCHAR(40) NOT NULL, 
	value NUMERIC(18, 6), 
	payload JSON, 
	PRIMARY KEY (id), 
	FOREIGN KEY(analysis_id) REFERENCES statistical_analyses (id)
);
CREATE INDEX ix_statistical_results_analysis_id ON statistical_results (analysis_id);

-- Seguridad: la API accede con el rol postgres (omite RLS). Activar RLS sin políticas
-- bloquea el acceso directo vía la API REST pública de Supabase (anon/authenticated).
alter table public.audit_logs enable row level security;
alter table public.companies enable row level security;
alter table public.roles enable row level security;
alter table public.categories enable row level security;
alter table public.customers enable row level security;
alter table public.users enable row level security;
alter table public.bayes_analyses enable row level security;
alter table public.datasets enable row level security;
alter table public.employees enable row level security;
alter table public.products enable row level security;
alter table public.random_variables enable row level security;
alter table public.reports enable row level security;
alter table public.dataset_variables enable row level security;
alter table public.inventory enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.sales enable row level security;
alter table public.statistical_analyses enable row level security;
alter table public.insights enable row level security;
alter table public.observations enable row level security;
alter table public.payments enable row level security;
alter table public.sale_details enable row level security;
alter table public.statistical_results enable row level security;

-- Índices adicionales para consultas analíticas
create index if not exists ix_sale_details_sale_product on sale_details (sale_id, product_id);
create index if not exists ix_audit_company_action on audit_logs (company_id, action);

commit;
