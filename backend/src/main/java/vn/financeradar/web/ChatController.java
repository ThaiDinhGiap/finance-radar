package vn.financeradar.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;
import vn.financeradar.application.ChatService;
import vn.financeradar.domain.*;

@RestController
@RequestMapping("/api/chat")
public class ChatController {
  private final ChatService chat;

  public ChatController(ChatService chat) {
    this.chat = chat;
  }

  public record Question(
      @NotBlank @Size(max = 1500) String question,
      @NotNull @Size(max = 3) List<@NotBlank @Size(max = 1500) String> previousQuestions,
      UUID sourceId,
      @NotNull @Pattern(regexp = "|vi|en|other") String language,
      @Min(1) @Max(3650) int days) {
    KnowledgeScope scope() {
      return new KnowledgeScope(sourceId, language, days);
    }
  }

  @GetMapping("/status")
  public ChatService.Status status() {
    return chat.status();
  }

  @PostMapping("/retrieve")
  public List<Article> retrieve(@Valid @RequestBody Question q) {
    return chat.retrieve(q.question(), q.previousQuestions(), q.scope());
  }

  @PostMapping("/answer")
  public ChatAnswer answer(@Valid @RequestBody Question q) {
    return chat.answer(q.question(), q.previousQuestions(), q.scope());
  }
}
