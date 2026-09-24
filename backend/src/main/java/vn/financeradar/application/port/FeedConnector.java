package vn.financeradar.application.port;

import java.util.List;
import vn.financeradar.domain.*;

public interface FeedConnector {
  Source.Kind kind();

  List<FeedItem> fetch(Source source) throws Exception;
}
