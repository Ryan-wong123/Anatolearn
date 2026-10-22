const repository = require('./annotations.repository');
async function listForModel(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.listForModel([input.params.id]);
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows });
}
async function exportAnnotations(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    try {
        const format = input.query.format === "csv" ? "csv" : "json";
        const result = await repository.listForExport([input.params.id]);
        if (format === "json") {
            (outcomeMeta.headers["Content-Disposition"] = `attachment; filename="model-${input.params.id}-annotations.json"`);
            (outcomeMeta.headers["Content-Type"] = "application/json");
            return ({ ...outcomeMeta, status: 200, kind: 'send', body: JSON.stringify(result.rows, null, 2) });
        }
        // CSV: common fields are flattened into columns; annotation_data (which
        // varies by annotation_type â€” point/highlight/region) is stringified
        // into its own column rather than split out, since a single flat
        // schema doesn't fit all three annotation shapes cleanly.
        const escapeCsv = (value) => {
            if (value === null || value === undefined)
                return "";
            const str = value instanceof Date
                ? value.toISOString()
                : typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value);
            return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
        };
        const header = "id,annotation_type,label,description,color,annotation_data,created_at";
        const rows = result.rows.map((r) => [r.id, r.annotation_type, r.label, r.description, r.color, r.annotation_data, r.created_at]
            .map(escapeCsv)
            .join(","));
        const csv = [header, ...rows].join("\n");
        (outcomeMeta.headers["Content-Disposition"] = `attachment; filename="model-${input.params.id}-annotations.csv"`);
        (outcomeMeta.headers["Content-Type"] = "text/csv");
        return ({ ...outcomeMeta, status: 200, kind: 'send', body: csv });
    }
    catch (err) {
        console.error("Failed to export annotations:", err);
        return ({ ...outcomeMeta, status: 500, kind: 'json', body: { message: err.message || "Failed to export annotations" } });
    }
}
async function createAnnotation(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { annotation_type, label, description, color, annotation_data } = input.body;
    const result = await repository.insertAnnotation([
        input.params.id,
        annotation_type,
        label,
        description || null,
        color || null,
        annotation_data || {},
    ]);
    return ({ ...outcomeMeta, status: 201, kind: 'json', body: result.rows[0] });
}
async function deleteAnnotation(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.deleteAnnotation([input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Annotation not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: { message: "Annotation deleted" } });
}
async function updateAnnotation(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const { annotation_type, label, description, color, annotation_data } = input.body;
    const result = await repository.updateAnnotation([annotation_type, label, description || null, color || null, annotation_data || {}, input.params.id]);
    if (result.rows.length === 0) {
        return ({ ...outcomeMeta, status: 404, kind: 'json', body: { message: "Annotation not found" } });
    }
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows[0] });
}
async function listAll(input) {
    const outcomeMeta = { headers: {}, cookies: [] };
    const result = await repository.listWithModelTitles();
    return ({ ...outcomeMeta, status: 200, kind: 'json', body: result.rows });
}
module.exports = { listForModel, exportAnnotations, createAnnotation, deleteAnnotation, updateAnnotation, listAll };
