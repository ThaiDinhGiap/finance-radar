package vn.financeradar.infrastructure.crawl;

import java.net.*;
import org.springframework.stereotype.Component;

@Component
public class PublicUrlPolicy {
  public URI validate(String value) {
    URI uri;
    try {
      uri = URI.create(value);
    } catch (Exception e) {
      throw new IllegalArgumentException("URL không hợp lệ");
    }
    if (!"https".equalsIgnoreCase(uri.getScheme())
        || uri.getHost() == null
        || uri.getUserInfo() != null
        || (uri.getPort() != -1 && uri.getPort() != 443)
        || value.length() > 2048)
      throw new IllegalArgumentException(
          "Chỉ hỗ trợ URL HTTPS công khai, cổng 443, không chứa thông tin đăng nhập");
    return uri;
  }

  public InetAddress[] resolve(String host) throws UnknownHostException {
    InetAddress[] addresses = InetAddress.getAllByName(host);
    for (InetAddress address : addresses)
      if (!isPublic(address))
        throw new UnknownHostException("Địa chỉ nội bộ hoặc dành riêng bị chặn");
    return addresses;
  }

  public boolean isPublic(InetAddress a) {
    if (a.isAnyLocalAddress()
        || a.isLoopbackAddress()
        || a.isLinkLocalAddress()
        || a.isSiteLocalAddress()
        || a.isMulticastAddress()) return false;
    byte[] b = a.getAddress();
    int first = b[0] & 255;
    if (b.length == 4) {
      int second = b[1] & 255;
      return first != 0
          && first != 10
          && first != 127
          && first < 224
          && !(first == 100 && second >= 64 && second <= 127)
          && !(first == 169 && second == 254)
          && !(first == 172 && second >= 16 && second <= 31)
          && !(first == 192 && (second == 168 || second == 0 || second == 2))
          && !(first == 198 && (second == 18 || second == 19 || second == 51))
          && !(first == 203 && second == 0);
    }
    // Only global unicast IPv6; exclude documentation and transition ranges.
    return (first & 0xe0) == 0x20
        && !(first == 0x20 && (b[1] & 255) == 0x02)
        && !(first == 0x20
            && (b[1] & 255) == 0x01
            && ((b[2] & 255) < 2 || ((b[2] & 255) == 0x0d && (b[3] & 255) == 0xb8)));
  }
}
