package vn.financeradar.web;

import jakarta.validation.constraints.*;
import vn.financeradar.domain.Source;

public record SourceRequest(
    @NotBlank @Size(max = 120) String name,
    @NotBlank @Size(max = 2048) String url,
    @NotNull Source.Kind kind,
    @NotNull Source.Category category,
    @NotBlank @Pattern(regexp = "vi|en|other") String language,
    @NotBlank @Pattern(regexp = "VN|US|EU|GLOBAL") String region,
    @Min(15) @Max(10080) int intervalMinutes,
    @Size(max = 300) String itemSelector,
    @Size(max = 300) String titleSelector,
    @Size(max = 300) String linkSelector,
    @Size(max = 300) String summarySelector) {}
