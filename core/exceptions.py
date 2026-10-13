from django.http import Http404
from rest_framework import exceptions
from rest_framework.exceptions import APIException
from rest_framework.response import Response
from rest_framework.views import exception_handler


def error_response(code: str, message: str, status_code: int = 400, details: list = None) -> Response:
    return Response(
        {
            "error": {
                "code": code,
                "message": message,
                "details": details if details is not None else [],
            }
        },
        status=status_code,
    )


class ContractError(APIException):
    def __init__(self, code: str, message: str, status_code: int = 400, details: list = None):
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details if details is not None else []
        super().__init__(detail=message)


class DuplicateError(ContractError):
    def __init__(self, message: str = "Resource already exists", details: list = None):
        super().__init__("DUPLICATE", message, status_code=409, details=details)


class NotFoundError(ContractError):
    def __init__(self, message: str = "Resource not found", details: list = None):
        super().__init__("NOT_FOUND", message, status_code=404, details=details)


class ValidationError(ContractError):
    def __init__(self, message: str = "Validation error", details: list = None):
        super().__init__("VALIDATION_ERROR", message, status_code=400, details=details)


class InsufficientStockError(ContractError):
    def __init__(self, message: str, details: list = None):
        super().__init__("INSUFFICIENT_STOCK", message, status_code=409, details=details)


class InvalidTransitionError(ContractError):
    def __init__(self, message: str = "Invalid order status transition", details: list = None):
        super().__init__("INVALID_TRANSITION", message, status_code=409, details=details)


class OrderLockedError(ContractError):
    def __init__(self, message: str = "Order cannot be modified in its current status", details: list = None):
        super().__init__("ORDER_LOCKED", message, status_code=409, details=details)


class IdempotencyConflictError(ContractError):
    def __init__(self, message: str = "Idempotency key reused with different request payload", details: list = None):
        super().__init__("IDEMPOTENCY_CONFLICT", message, status_code=409, details=details)


def custom_exception_handler(exc, context):
    if isinstance(exc, ContractError):
        return error_response(exc.code, exc.message, exc.status_code, exc.details)

    if isinstance(exc, (Http404, exceptions.NotFound)):
        return error_response("NOT_FOUND", "Resource not found", 404)

    if isinstance(exc, exceptions.ValidationError):
        details = []
        if isinstance(exc.detail, list):
            details = [str(x) for x in exc.detail]
        elif isinstance(exc.detail, dict):
            for k, v in exc.detail.items():
                if isinstance(v, list):
                    details.extend([f"{k}: {x}" for x in v])
                else:
                    details.append(f"{k}: {v}")
        else:
            details = [str(exc.detail)]
        return error_response("VALIDATION_ERROR", "Validation error", 400, details=details)

    response = exception_handler(exc, context)
    if response is not None:
        code = "VALIDATION_ERROR" if response.status_code == 400 else "ERROR"
        if response.status_code == 404:
            code = "NOT_FOUND"
        elif response.status_code == 409:
            code = "CONFLICT"
        return error_response(code, str(exc), response.status_code)

    return None
