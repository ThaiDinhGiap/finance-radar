package vn.financeradar.application;

import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class ArticleChunker {
  public static final int VERSION = 1;
  private static final int SIZE = 1200, OVERLAP = 180;

  public List<String> split(String title, String summary) {
    String text = (title + "\n\n" + summary).strip();
    List<String> chunks = new ArrayList<>();
    for (int start = 0; start < text.length(); ) {
      int end = Math.min(start + SIZE, text.length());
      if (end < text.length()) {
        int boundary = text.lastIndexOf(' ', end);
        if (boundary > start + SIZE / 2) end = boundary;
        if (Character.isHighSurrogate(text.charAt(end - 1))) end--;
      }
      chunks.add(text.substring(start, end));
      if (end == text.length()) break;
      start = end - OVERLAP;
      if (Character.isLowSurrogate(text.charAt(start))) start++;
    }
    return List.copyOf(chunks);
  }
}
