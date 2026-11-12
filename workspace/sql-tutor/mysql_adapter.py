"""Run the tutor's MySQL-compatible exercise subset in the workspace runner."""

from sqlglot import exp, parse, parse_one
from sqlglot.dialects.sqlite import SQLite
from sqlglot.errors import ErrorLevel, SqlglotError


class TutorSQLite(SQLite):
    class Generator(SQLite.Generator):
        # SQLite accepts named CTE columns, including the scalar wrapper's value.
        SUPPORTS_TABLE_ALIAS_COLUMNS = True


# The adapter runs in the tutor worker's own Python namespace.
_workspace_prepare_sql_case = prepare_sql_case


class ScalarValue:
    def __init__(self):
        self.seen = False
        self.value = None

    def step(self, value):
        if self.seen:
            raise ValueError("Scalar subquery returned multiple rows")
        self.seen = True
        self.value = value

    def finalize(self):
        return self.value


def prepare_sql_case(connection, schema, tables):
    _workspace_prepare_sql_case(connection, schema, tables)
    connection.create_aggregate("_tutor_scalar", 1, ScalarValue)


def is_scalar(node):
    return not isinstance(node.parent, (exp.From, exp.Join, exp.In, exp.Any, exp.All, exp.Exists))


def evaluate_tutor(payload):
    try:
        statements = [tree for tree in parse(payload["code"], read="mysql") if tree]
        if len(statements) != 1 or not isinstance(statements[0], exp.Query):
            return {"message": "Submit one SELECT or WITH query."}
        tree = statements[0]
        if any(tree.find_all(exp.Any, exp.All)):
            return {"message": "ANY/ALL can run in MySQL, but this browser grader cannot execute that syntax. Use the syntax required by this exercise."}
        sql_tree = tree.copy()
        for division in reversed(list(sql_tree.find_all(exp.Div))):
            division.set("this", exp.Cast(this=division.this.copy(), to=exp.DataType.build("DOUBLE")))
        for index, subquery in enumerate(reversed(list(sql_tree.find_all(exp.Subquery)))):
            if not is_scalar(subquery):
                continue
            alias = f"_tutor_scalar_rows_{index}"
            wrapped = parse_one(f"(WITH {alias}(value) AS (SELECT 1) SELECT _tutor_scalar(value) FROM {alias})")
            wrapped.find(exp.CTE).set("this", subquery.this)
            subquery.replace(wrapped)
        payload["code"] = sql_tree.sql(dialect=TutorSQLite, unsupported_level=ErrorLevel.RAISE)
    except SqlglotError as error:
        return {"message": "Check the MySQL syntax. " + str(error)}
    requirements = payload.pop("methods", [])
    missing = [name for name in requirements if not uses_method(tree, name)]
    result = evaluate_sql(payload)
    for case in result["results"]:
        if case.get("error") == "user-defined aggregate's 'step' method raised error":
            case["error"] = "A scalar subquery returned more than one row. MySQL reports an error in this case."
    result["missing"] = missing
    return result


def uses_method(tree, method):
    if method == "scalar":
        return any(is_scalar(node) for node in tree.find_all(exp.Subquery))
    if method == "select_scalar":
        return any(isinstance(node.parent, exp.Select) or node.find_ancestor(exp.Alias) is not None for node in tree.find_all(exp.Subquery))
    if method == "inline":
        return any(isinstance(node.parent, (exp.From, exp.Join)) for node in tree.find_all(exp.Subquery))
    if method == "tuple_in":
        return any(isinstance(node.this, exp.Tuple) and node.args.get("query") for node in tree.find_all(exp.In))
    if method == "range":
        return any(node.args.get("kind") == "RANGE" for node in tree.find_all(exp.WindowSpec))
    if method == "window":
        return tree.find(exp.Window) is not None
    if method == "no_window":
        return tree.find(exp.Window) is None
    if method == "no_exists":
        return tree.find(exp.Exists) is None
    if method == "count_over":
        return any(isinstance(node.this, exp.Count) for node in tree.find_all(exp.Window))
    return any(node.key == method for node in tree.walk())

