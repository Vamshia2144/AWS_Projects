import json
import os
from datetime import datetime, timezone
import boto3

TABLE_NAME = os.environ.get("TABLE_NAME", "FeatureFlags")
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE_NAME)

def build_response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS"
        },
        "body": json.dumps(body)
    }

def current_time():
    return datetime.now(timezone.utc).isoformat()

def parse_body(event):
    body = event.get("body")
    if not body:
        return {}
    if isinstance(body, str):
        return json.loads(body)
    return body

def lambda_handler(event, context):
    print("EVENT:", json.dumps(event))
    try:
        method = event.get("requestContext", {}).get("http", {}).get("method", "")
        raw_path = event.get("rawPath", "")
        path_params = event.get("pathParameters") or {}
        feature_name = path_params.get("featureName")

        print("METHOD:", method)
        print("RAW PATH:", raw_path)
        print("PATH PARAMS:", path_params)
        print("FEATURE NAME:", feature_name)

        if method == "OPTIONS":
            return build_response(200, {"message": "CORS preflight OK"})

        if method == "GET" and raw_path == "/flags":
            print("ROUTE: GET ALL FLAGS")
            return get_all_flags()

        if method == "POST" and raw_path == "/flags":
            print("ROUTE: CREATE FLAG")
            return create_flag(event)

        if method == "GET" and feature_name:
            print("ROUTE: GET ONE FLAG")
            return get_flag(feature_name)

        if method == "PUT" and feature_name:
            print("ROUTE: UPDATE FLAG")
            return update_flag(feature_name, event)

        if method == "DELETE" and feature_name:
            print("ROUTE: DELETE FLAG")
            return delete_flag(feature_name)

        print("ROUTE NOT FOUND")
        return build_response(404, {"message": "Route not found", "method": method, "rawPath": raw_path})

    except Exception as e:
        print("ERROR:", str(e))
        return build_response(500, {"message": "Internal server error", "error": str(e)})

def create_flag(event):
    data = parse_body(event)
    print("CREATE DATA:", data)

    feature_name = data.get("featureName")
    enabled = data.get("enabled")
    description = data.get("description", "")
    created_by = data.get("createdBy", "admin")

    if not feature_name:
        return build_response(400, {"message": "featureName is required"})

    if enabled is None:
        return build_response(400, {"message": "enabled is required"})

    existing = table.get_item(Key={"featureName": feature_name})
    if "Item" in existing:
        return build_response(409, {"message": "Feature flag already exists"})

    timestamp = current_time()
    item = {
        "featureName": feature_name,
        "enabled": bool(enabled),
        "description": description,
        "createdBy": created_by,
        "createdAt": timestamp,
        "updatedAt": timestamp
    }

    table.put_item(Item=item)
    print("CREATED ITEM:", item)

    return build_response(201, {
        "message": "Feature flag created successfully",
        "item": item
    })

def get_all_flags():
    result = table.scan()
    items = result.get("Items", [])
    items.sort(key=lambda x: x.get("featureName", ""))
    print("ALL FLAGS:", items)
    return build_response(200, items)

def get_flag(name):
    result = table.get_item(Key={"featureName": name})
    item = result.get("Item")

    if not item:
        return build_response(404, {"message": "Feature flag not found"})

    return build_response(200, item)

def update_flag(name, event):
    result = table.get_item(Key={"featureName": name})
    item = result.get("Item")

    if not item:
        return build_response(404, {"message": "Feature flag not found"})

    data = parse_body(event)
    print("UPDATE DATA:", data)

    enabled = data.get("enabled", item.get("enabled"))
    description = data.get("description", item.get("description"))
    updated_at = current_time()

    table.update_item(
        Key={"featureName": name},
        UpdateExpression="SET enabled = :enabled, description = :description, updatedAt = :updatedAt",
        ExpressionAttributeValues={
            ":enabled": bool(enabled),
            ":description": description,
            ":updatedAt": updated_at
        }
    )

    updated_item = table.get_item(Key={"featureName": name}).get("Item")
    print("UPDATED ITEM:", updated_item)

    return build_response(200, {
        "message": "Feature flag updated successfully",
        "item": updated_item
    })

def delete_flag(name):
    result = table.get_item(Key={"featureName": name})
    item = result.get("Item")

    if not item:
        return build_response(404, {"message": "Feature flag not found"})

    table.delete_item(Key={"featureName": name})
    print("DELETED FLAG:", name)

    return build_response(200, {"message": "Feature flag deleted successfully"})