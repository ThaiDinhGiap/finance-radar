package vn.financeradar.web;

import jakarta.validation.ConstraintViolationException;
import java.util.NoSuchElementException;
import org.slf4j.*;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class ApiExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

  @ExceptionHandler(NoSuchElementException.class)
  ProblemDetail missing(NoSuchElementException e) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
  }

  @ExceptionHandler(IllegalStateException.class)
  ProblemDetail conflict(IllegalStateException e) {
    return ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, e.getMessage());
  }

  @ExceptionHandler(DataIntegrityViolationException.class)
  ProblemDetail duplicate(DataIntegrityViolationException e) {
    return ProblemDetail.forStatusAndDetail(
        HttpStatus.CONFLICT, "Nguồn đã tồn tại hoặc dữ liệu không hợp lệ");
  }

  @ExceptionHandler({
    IllegalArgumentException.class,
    ConstraintViolationException.class,
    MethodArgumentNotValidException.class,
    HandlerMethodValidationException.class,
    MethodArgumentTypeMismatchException.class,
    HttpMessageNotReadableException.class
  })
  ProblemDetail badRequest(Exception e) {
    String message =
        e instanceof IllegalArgumentException
            ? e.getMessage()
            : "Dữ liệu không hợp lệ. Kiểm tra URL, trường bắt buộc và khoảng giá trị.";
    return ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, message);
  }

  @ExceptionHandler(vn.financeradar.application.ChatFailure.class)
  ProblemDetail chat(vn.financeradar.application.ChatFailure e) {
    HttpStatus status =
        switch (e.reason()) {
          case NOT_CONFIGURED -> HttpStatus.SERVICE_UNAVAILABLE;
          case BUSY -> HttpStatus.TOO_MANY_REQUESTS;
          case UPSTREAM, INVALID_EVIDENCE -> HttpStatus.BAD_GATEWAY;
        };
    return ProblemDetail.forStatusAndDetail(status, e.getMessage());
  }

  @ExceptionHandler(Exception.class)
  ProblemDetail unexpected(Exception e) {
    log.error("Unhandled API failure", e);
    return ProblemDetail.forStatusAndDetail(
        HttpStatus.INTERNAL_SERVER_ERROR, "Có lỗi xử lý. Vui lòng thử lại sau.");
  }
}
