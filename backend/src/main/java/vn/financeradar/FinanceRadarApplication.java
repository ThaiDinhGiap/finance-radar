package vn.financeradar;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class FinanceRadarApplication {
  public static void main(String[] args) {
    SpringApplication.run(FinanceRadarApplication.class, args);
  }
}
