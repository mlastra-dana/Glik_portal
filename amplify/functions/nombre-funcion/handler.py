import base64
import json
import logging
import os
import re
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any, Dict, Optional, Tuple

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "")
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN", "*")
DOCUMENTS_BUCKET_NAME = os.environ.get("DOCUMENTS_BUCKET_NAME", "")
SLOT_VALIDATION_MAX_WORKERS = int(os.environ.get("SLOT_VALIDATION_MAX_WORKERS", "4"))
BEDROCK_MAX_TOKENS = int(os.environ.get("BEDROCK_MAX_TOKENS", "260"))

if not BEDROCK_MODEL_ID:
    logger.warning("BEDROCK_MODEL_ID no está definido en variables de entorno.")

# Para modelos Claude 3.7 / 4 AWS recomienda aumentar read_timeout bastante.
# Dejamos 300s como valor inicial razonable para demo.
bedrock = boto3.client(
    "bedrock-runtime",
    region_name=AWS_REGION,
    config=Config(read_timeout=300, connect_timeout=10, retries={"max_attempts": 2}),
)
s3 = boto3.client("s3", region_name=AWS_REGION)


def cors_headers() -> Dict[str, str]:
    return {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "OPTIONS,POST",
    }


def response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": cors_headers(),
        "body": json.dumps(body, ensure_ascii=False),
    }


def sanitize_filename(filename: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", filename.strip())
    return cleaned or "documento"


def create_upload_url(slot: str, filename: str, content_type: str) -> Dict[str, Any]:
    if not DOCUMENTS_BUCKET_NAME:
        return response(
            500,
            {
                "success": False,
                "message": "DOCUMENTS_BUCKET_NAME no está configurado.",
            },
        )

    safe_name = sanitize_filename(filename)
    key = f"expedientes/{slot}/{uuid.uuid4().hex}_{safe_name}"
    try:
        upload_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": DOCUMENTS_BUCKET_NAME,
                "Key": key,
                "ContentType": content_type or "application/octet-stream",
            },
            ExpiresIn=900,
        )
    except (ClientError, BotoCoreError) as exc:
        logger.exception("No se pudo crear URL presignada")
        return response(
            500,
            {
                "success": False,
                "message": f"No se pudo generar URL de carga: {str(exc)}",
            },
        )

    return response(
        200,
        {
            "success": True,
            "bucket": DOCUMENTS_BUCKET_NAME,
            "key": key,
            "upload_url": upload_url,
            "expires_in": 900,
        },
    )


def get_document_bytes(filename: str, document: Dict[str, Any]) -> bytes:
    content_base64 = document.get("content_base64")
    if content_base64:
        return base64.b64decode(content_base64)

    s3_key = document.get("s3_key")
    s3_bucket = document.get("s3_bucket") or DOCUMENTS_BUCKET_NAME
    if s3_key and s3_bucket:
        obj = s3.get_object(Bucket=s3_bucket, Key=s3_key)
        return obj["Body"].read()

    raise ValueError(f"No se recibió contenido ni referencia S3 para {filename}")


def get_extension(filename: str) -> str:
    if "." not in filename:
        return ""
    return filename.rsplit(".", 1)[-1].lower().strip()


def normalize_image_format(ext: str) -> str:
    if ext == "jpg":
        return "jpeg"
    return ext


def normalize_plate(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None
    cleaned = re.sub(r"\s+", "", value).upper().strip()
    # placas venezolanas típicamente 6-7 alfanuméricos
    if re.fullmatch(r"[A-Z0-9]{6,7}", cleaned):
        return cleaned
    return cleaned if cleaned else None


def normalize_serial(value: Optional[str]) -> Optional[str]:
    if not value or not isinstance(value, str):
        return None
    cleaned = re.sub(r"[^A-Z0-9]", "", value.upper())
    return cleaned or None


VIN_TRANSLITERATION = {
    "A": 1,
    "B": 2,
    "C": 3,
    "D": 4,
    "E": 5,
    "F": 6,
    "G": 7,
    "H": 8,
    "J": 1,
    "K": 2,
    "L": 3,
    "M": 4,
    "N": 5,
    "P": 7,
    "R": 9,
    "S": 2,
    "T": 3,
    "U": 4,
    "V": 5,
    "W": 6,
    "X": 7,
    "Y": 8,
    "Z": 9,
}
VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2]
VIN_REGEX = re.compile(r"^[A-HJ-NPR-Z0-9]{17}$")


def is_valid_vin(vin: Optional[str]) -> bool:
    if not vin or not isinstance(vin, str):
        return False
    normalized = normalize_serial(vin)
    if not normalized or not VIN_REGEX.fullmatch(normalized):
        return False

    total = 0
    for index, char in enumerate(normalized):
        if char.isdigit():
            value = int(char)
        else:
            value = VIN_TRANSLITERATION.get(char)
            if value is None:
                return False
        total += value * VIN_WEIGHTS[index]

    check_digit = "X" if (total % 11) == 10 else str(total % 11)
    return normalized[8] == check_digit


def is_vin_like(vin: Optional[str]) -> bool:
    if not vin or not isinstance(vin, str):
        return False
    normalized = normalize_serial(vin)
    if not normalized:
        return False
    return bool(VIN_REGEX.fullmatch(normalized))


def sanitize_slot_result(slot: str, result: Dict[str, Any]) -> Dict[str, Any]:
    normalized_result = {
        "document_valid": bool(result.get("document_valid")),
        "plate": normalize_plate(result.get("plate")),
        "serial": normalize_serial(result.get("serial")),
        "reason": result.get("reason"),
    }

    # Regla de negocio: en factura NO se muestra serial dudoso.
    # Si no es VIN válido (incluyendo dígito verificador), se devuelve null.
    if slot == "invoice":
        invoice_serial = normalized_result.get("serial")
        if not is_valid_vin(invoice_serial):
            normalized_result["serial"] = None
            if normalized_result["document_valid"]:
                normalized_result["reason"] = "Factura válida sin serial"

    return normalized_result


def safe_json_loads(raw: str) -> Dict[str, Any]:
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        # Intento de rescate si el modelo devolvió texto adicional
        match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not match:
            raise
        return json.loads(match.group(0))


def extract_text_from_bedrock_response(resp: Dict[str, Any]) -> str:
    """
    Extrae el texto concatenado de output.message.content[*].text
    """
    try:
        content_blocks = resp["output"]["message"]["content"]
        texts = [block["text"] for block in content_blocks if "text" in block]
        return "\n".join(texts).strip()
    except Exception as exc:
        raise ValueError(f"No se pudo leer la respuesta de Bedrock: {exc}") from exc


def make_user_message(slot: str, filename: str, file_bytes: bytes) -> Dict[str, Any]:
    """
    Construye el bloque de mensaje para Converse.
    - Para PDF: usa document + text
    - Para imagen: usa image + text
    """
    ext = get_extension(filename)

    if ext in {"pdf"}:
        return {
            "role": "user",
            "content": [
                {
                    "text": f"Analiza este documento para el slot '{slot}' y responde según las instrucciones."
                },
                {
                    "document": {
                        "format": "pdf",
                        "name": "documento",
                        "source": {"bytes": file_bytes},
                    }
                },
            ],
        }

    if ext in {"png", "jpg", "jpeg", "webp", "gif"}:
        return {
            "role": "user",
            "content": [
                {
                    "text": f"Analiza esta imagen para el slot '{slot}' y responde según las instrucciones."
                },
                {
                    "image": {
                        "format": normalize_image_format(ext),
                        "source": {"bytes": file_bytes},
                    }
                },
            ],
        }

    raise ValueError(f"Extensión no soportada para {filename}: {ext}")


def invoke_bedrock_json_extractor(slot: str, filename: str, document: Dict[str, Any]) -> Dict[str, Any]:
    """
    Invoca Bedrock para un slot específico y espera un JSON estricto.
    """
    file_bytes = get_document_bytes(filename, document)
    user_message = make_user_message(slot, filename, file_bytes)

    system_prompt = build_system_prompt(slot)

    try:
        resp = bedrock.converse(
            modelId=BEDROCK_MODEL_ID,
            system=[{"text": system_prompt}],
            messages=[user_message],
            inferenceConfig={
                "temperature": 0,
                "maxTokens": BEDROCK_MAX_TOKENS,
                "topP": 0.1,
            },
        )
        raw_text = extract_text_from_bedrock_response(resp)
        logger.info("Respuesta Bedrock slot=%s raw=%s", slot, raw_text)
        return safe_json_loads(raw_text)
    except (ClientError, BotoCoreError, ValueError, json.JSONDecodeError) as exc:
        logger.exception("Error invocando Bedrock para slot=%s", slot)
        return {
            "document_valid": False,
            "plate": None,
            "serial": None,
            "reason": f"Error procesando documento: {str(exc)}",
        }


def build_system_prompt(slot: str) -> str:
    if slot == "invoice":
        return """
Analiza la factura proporcionada y extrae únicamente la información visible en el documento.

Responde exclusivamente con JSON válido.
No agregues explicaciones.
No agregues texto antes ni después del JSON.
No uses markdown.
No inventes datos.
Si un campo no aparece claramente en el documento, devuelve null.

Debes devolver exactamente este esquema:
{
  "document_valid": false,
  "plate": null,
  "serial": null,
  "reason": null
}

Reglas generales de normalización:
- Todos los campos de texto deben devolverse sin espacios al inicio o al final.
- Si un texto contiene múltiples espacios internos consecutivos, colapsarlos a un solo espacio.
- Los valores null deben devolverse como JSON null.
- No inventes códigos ni formatos no visibles en el documento.

Reglas de extracción:
- document_valid:
  Debe ser true solo si el archivo corresponde claramente a una factura.
  Si no corresponde, devolver false.

- plate:
  Extraer la placa solo si aparece explícitamente y claramente asociada al vehículo.
  Priorizar etiquetas cercanas como: "PLACA", "PLACA VEHÍCULO", "PLACA DEL VEHÍCULO".
  Si no aparece claramente, devolver null.

- serial:
  Extraer solo serial del vehículo (VIN, N° CHASIS, SERIAL MOTOR, SERIAL CARROCERÍA).
  Si existe VIN, usarlo de preferencia como serial.
  Aceptar serial solo cuando esté asociado a etiquetas de identificación vehicular.
  Si el documento tiene tabla con columnas "VIN" y "Motor", el serial debe salir de la columna "VIN" de la línea del producto.
  Nunca usar la columna "Motor" como serial cuando exista "VIN".
  En facturas con cabecera de detalle tipo "Ref.Fab | Descripción | Cant | UM | VIN | Motor ...":
  leer únicamente el valor de la celda bajo "VIN" en la misma fila del producto.
  No concatenar texto de celdas vecinas ni tomar texto fuera de esa columna.
  Si el valor VIN no tiene 17 caracteres alfanuméricos claros, devolver serial = null.
  Si el VIN no pasa validación de dígito verificador (ISO 3779, posición 9), mantenerlo igual si es claramente legible
  (puede haber ruido OCR en un carácter).
  Si no hay etiqueta clara de vehículo, devolver serial = null.

Reglas de descarte:
- Ignorar datos administrativos de factura: RIF/VAT, nombre, dirección, moneda, número de control (nro_ctrl),
  número de factura (supplier_invoice_number), códigos de producto (product_id), cantidades/precios y líneas de detalle.
- Nunca usar como serial campos administrativos aunque parezcan alfanuméricos.
- No confundir serial/VIN con número de factura, control interno, referencia comercial o código de cliente.
- Ignorar textos de marca de agua/fondo y artefactos OCR fuera de la tabla de detalle.
- Manejar ambigüedades OCR frecuentes: 0/O, 1/I, 5/S, 8/B, 6/G, 2/Z.

reason:
- Debe ser una frase corta y operativa, por ejemplo:
  - "Factura válida"
  - "No corresponde a una factura"
  - "Factura válida sin placa"
  - "Factura válida sin serial"

Devuelve únicamente el JSON final.
""".strip()

    if slot == "certificate_of_origin":
        return """
Analiza el documento logístico proporcionado y extrae únicamente la información visible en el documento.

Responde exclusivamente con JSON válido.
No agregues explicaciones.
No agregues texto antes ni después del JSON.
No uses markdown.
No inventes datos.
Si un campo no aparece claramente en el documento, devuelve null.

Debes devolver exactamente este esquema:
{
  "document_valid": false,
  "plate": null,
  "serial": null,
  "reason": null
}

Reglas generales de normalización:
- Todos los campos de texto deben devolverse sin espacios al inicio o al final.
- Si un texto contiene múltiples espacios internos consecutivos, colapsarlos a un solo espacio.
- Los valores null deben devolverse como JSON null.
- No inventes códigos ni formatos no visibles en el documento.
- El certificado de origen es la referencia principal del expediente para placa/serial.

Reglas de extracción:
- document_valid:
  Debe ser true solo si el archivo corresponde claramente a un certificado de origen.
  Si no corresponde, devolver false.

- plate:
  Extraer la placa solo si aparece explícitamente y claramente asociada al vehículo.
  Priorizar etiquetas como: "PLACA", "PLACA DEL VEHÍCULO", "IDENTIFICACIÓN VEHÍCULO".
  Si no aparece claramente, devolver null.

- serial:
  Extraer el serial del vehículo (VIN, N° CHASIS, SERIAL MOTOR, SERIAL CARROCERÍA) solo si aparece explícitamente.
  Priorizar VIN cuando esté presente.
  Si no aparece claramente, devolver null.

Reglas de descarte:
- Ignorar números administrativos: acta, consecutivo, control, póliza, RIF, referencia, orden interna.
- No confundir serial/VIN con números de factura, pedido o códigos comerciales.
- Si hay múltiples candidatos, elegir el más consistente con etiquetas de identificación del vehículo.
- Manejar ambigüedades OCR frecuentes: 0/O, 1/I, 5/S, 8/B, 6/G, 2/Z.

reason:
- Debe ser una frase corta y operativa, por ejemplo:
  - "Certificado válido"
  - "No corresponde a un certificado de origen"
  - "Certificado válido sin placa"
  - "Certificado válido sin serial"

Devuelve únicamente el JSON final.
""".strip()

    if slot == "photo_plate":
        return """
Eres un validador documental de motocicletas.

Tu tarea es validar si la imagen cargada corresponde a una FOTOGRAFÍA DE PLACA y extraer únicamente la placa visible.

Responde exclusivamente con JSON válido.
No agregues explicaciones.
No agregues texto antes ni después del JSON.
No uses markdown.
No inventes datos.

Debes devolver exactamente este esquema:
{
  "document_valid": false,
  "plate": null,
  "serial": null,
  "reason": null
}

Reglas:
- document_valid debe ser true solo si la imagen corresponde claramente a una foto donde se vea una placa de motocicleta o vehículo.
- plate: extraer solo la placa visible.
- serial debe ser null en este tipo de documento.
- No confundas placa con VIN, serial de motor, serial de carrocería u otros identificadores.
- Si no se ve una placa clara, document_valid = false.
- reason debe contener una frase corta:
  - "Fotoplaca válida"
  - "No corresponde a una fotoplaca"
  - "Placa no legible"

La placa debe devolverse en MAYÚSCULAS.
""".strip()

    if slot == "photo_serial":
        return """
Eres un validador documental de motocicletas.

Tu tarea es validar si la imagen cargada corresponde a una FOTOGRAFÍA DE SERIAL y extraer únicamente el serial visible.

Responde exclusivamente con JSON válido.
No agregues explicaciones.
No agregues texto antes ni después del JSON.
No uses markdown.
No inventes datos.

Debes devolver exactamente este esquema:
{
  "document_valid": false,
  "plate": null,
  "serial": null,
  "reason": null
}

Reglas:
- document_valid debe ser true solo si la imagen corresponde claramente a una foto de serial de motor, serial de carrocería, serial de chasis o VIN.
- serial: extraer únicamente el serial visible grabado en la pieza del chasis/motor (texto estampado o grabado).
- plate debe ser null en este tipo de documento.
- Prioriza serial de 17 caracteres tipo VIN cuando esté presente.
- Lee el serial carácter por carácter en el orden exacto (sin inventar ni completar).
- Ignora texto de etiquetas adhesivas, códigos de barras, números de lote, referencias de fábrica y cualquier texto impreso en mangueras/cables.
- Ignora texto parcial borroso o tapado por dedos/cables.
- Si hay más de un candidato, elige el que esté físicamente grabado en metal/chasis y no el de stickers.
- Si no puedes leer el serial completo con alta confianza, devuelve serial = null y document_valid = false.
- Si no se ve un serial claro, document_valid = false.
- reason debe contener una frase corta:
  - "Fotoserial válido"
  - "No corresponde a un fotoserial"
  - "Serial no legible"

El serial debe devolverse como texto limpio.
""".strip()

    raise ValueError(f"Slot no soportado: {slot}")


def compare_values(a: Optional[str], b: Optional[str], mode: str) -> Optional[bool]:
    """
    Devuelve:
    - True si ambos existen y coinciden
    - False si ambos existen y no coinciden
    - None si alguno falta
    """
    if not a or not b:
        return None

    if mode == "plate":
        return normalize_plate(a) == normalize_plate(b)
    if mode == "serial":
        return normalize_serial(a) == normalize_serial(b)

    return None


def aggregate_match(*values: Optional[bool]) -> Optional[bool]:
    """
    Si hay un False => False
    Si todos los no-null son True y hay al menos uno => True
    Si no hay suficientes datos => None
    """
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    if any(v is False for v in vals):
        return False
    return True


def process_slot(slot: str, doc: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    filename = doc.get("filename")
    has_base64 = bool(doc.get("content_base64"))
    has_s3_ref = bool(doc.get("s3_key"))

    if not filename or (not has_base64 and not has_s3_ref):
        return (
            slot,
            {
                "document_valid": False,
                "plate": None,
                "serial": None,
                "reason": "Documento no suministrado correctamente",
            },
        )

    result = invoke_bedrock_json_extractor(
        slot=slot,
        filename=filename,
        document=doc,
    )
    return slot, sanitize_slot_result(slot, result)


def handle_validate_slot(body: Dict[str, Any]) -> Dict[str, Any]:
    slot = body.get("slot")
    document = body.get("document") or {}

    valid_slots = {"invoice", "certificate_of_origin", "photo_plate", "photo_serial"}
    if slot not in valid_slots:
        return response(400, {"success": False, "message": "slot inválido"})

    slot_name, result = process_slot(slot, document)
    return response(
        200,
        {
            "success": True,
            "slot": slot_name,
            "result": result,
        },
    )


def lambda_handler(event, context):
    # Preflight CORS
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return {
            "statusCode": 200,
            "headers": cors_headers(),
            "body": "",
        }

    if event.get("requestContext", {}).get("http", {}).get("method") != "POST":
        return response(405, {"success": False, "message": "Method not allowed"})

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return response(400, {"success": False, "message": "Body JSON inválido"})

    action = body.get("action")
    if action == "create_upload_url":
        slot = body.get("slot") or "general"
        filename = body.get("filename") or ""
        content_type = body.get("content_type") or "application/octet-stream"
        if not filename:
            return response(400, {"success": False, "message": "filename es requerido"})
        return create_upload_url(slot=slot, filename=filename, content_type=content_type)
    if action == "validate_slot":
        return handle_validate_slot(body)

    documents = body.get("documents") or {}
    expedient_id = body.get("expedient_id")

    required_slots = ["invoice", "certificate_of_origin", "photo_plate", "photo_serial"]
    missing_slots = [slot for slot in required_slots if slot not in documents]
    if missing_slots:
        return response(
            400,
            {
                "success": False,
                "message": "Faltan documentos requeridos",
                "missing_slots": missing_slots,
            },
        )

    extraction_results: Dict[str, Dict[str, Any]] = {}

    max_workers = max(1, min(SLOT_VALIDATION_MAX_WORKERS, len(required_slots)))
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_by_slot = {
            executor.submit(process_slot, slot, documents.get(slot) or {}): slot
            for slot in required_slots
        }
        for future in as_completed(future_by_slot):
            slot = future_by_slot[future]
            try:
                resolved_slot, result = future.result()
                extraction_results[resolved_slot] = result
            except Exception as exc:
                logger.exception("Error en procesamiento paralelo para slot=%s", slot)
                extraction_results[slot] = {
                    "document_valid": False,
                    "plate": None,
                    "serial": None,
                    "reason": f"Error procesando documento: {str(exc)}",
                }

    # Normalizar valores extraídos
    invoice_plate = normalize_plate(extraction_results["invoice"].get("plate"))
    cert_plate = normalize_plate(extraction_results["certificate_of_origin"].get("plate"))
    photo_plate = normalize_plate(extraction_results["photo_plate"].get("plate"))

    invoice_serial = normalize_serial(extraction_results["invoice"].get("serial"))
    cert_serial = normalize_serial(extraction_results["certificate_of_origin"].get("serial"))
    photo_serial = normalize_serial(extraction_results["photo_serial"].get("serial"))

    # Validaciones de tipo documental
    invoice_valid = bool(extraction_results["invoice"].get("document_valid"))
    certificate_valid = bool(extraction_results["certificate_of_origin"].get("document_valid"))
    photo_plate_valid = bool(extraction_results["photo_plate"].get("document_valid"))
    photo_serial_valid = bool(extraction_results["photo_serial"].get("document_valid"))

    # Comparaciones
    plate_match = aggregate_match(
        compare_values(invoice_plate, cert_plate, "plate"),
        compare_values(invoice_plate, photo_plate, "plate"),
        compare_values(cert_plate, photo_plate, "plate"),
    )

    serial_match = aggregate_match(
        compare_values(invoice_serial, cert_serial, "serial"),
        compare_values(invoice_serial, photo_serial, "serial"),
        compare_values(cert_serial, photo_serial, "serial"),
    )

    same_expedient = (
        invoice_valid
        and certificate_valid
        and photo_plate_valid
        and photo_serial_valid
        and plate_match is True
        and serial_match is True
    )

    messages = []

    # Mensajes por tipo
    for slot, label in [
        ("invoice", "La factura"),
        ("certificate_of_origin", "El certificado de origen"),
        ("photo_plate", "La fotoplaca"),
        ("photo_serial", "El fotoserial"),
    ]:
        if extraction_results[slot].get("document_valid"):
            messages.append(f"{label} corresponde al tipo documental esperado.")
        else:
            reason = extraction_results[slot].get("reason") or "Tipo documental inválido."
            messages.append(f"{label}: {reason}")

    # Mensajes de coincidencia
    if plate_match is True:
        messages.append("La placa coincide entre documentos e imagen.")
    elif plate_match is False:
        messages.append("La placa no coincide entre los documentos e imagen.")
    else:
        messages.append("No hubo suficientes datos para validar la placa en todas las fuentes.")

    if serial_match is True:
        messages.append("El serial coincide entre documentos e imagen.")
    elif serial_match is False:
        messages.append("El serial no coincide entre los documentos e imagen.")
    else:
        messages.append("No hubo suficientes datos para validar el serial en todas las fuentes.")

    overall_status = "validated" if same_expedient else "manual_review"

    result = {
        "success": True,
        "expedient_id": expedient_id,
        "document_validation": {
            "invoice_valid": invoice_valid,
            "certificate_of_origin_valid": certificate_valid,
            "photo_plate_valid": photo_plate_valid,
            "photo_serial_valid": photo_serial_valid,
        },
        "extracted_data": {
            "invoice_plate": invoice_plate,
            "certificate_plate": cert_plate,
            "photo_plate": photo_plate,
            "invoice_serial": invoice_serial,
            "certificate_serial": cert_serial,
            "photo_serial": photo_serial,
        },
        "cross_validation": {
            "plate_match": plate_match,
            "serial_match": serial_match,
            "same_expedient": same_expedient,
        },
        "overall_status": overall_status,
        "messages": messages,
        "raw_extractions": extraction_results,
    }

    return response(200, result)
