package com.hoopr.push;
import com.fasterxml.jackson.databind.*;
import java.io.IOException;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.Set;
import org.springframework.beans.factory.annotation.*;
import org.springframework.stereotype.Service;
@Service
public class ExpoPushGateway {
 private final ObjectMapper json;private final String token;private final HttpClient http;private final URI base;
 @Autowired public ExpoPushGateway(ObjectMapper json,@Value("${hoopr.push.expo-access-token:}") String token){this(json,token,HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build(),URI.create("https://exp.host/--/api/v2/push/"));}
 ExpoPushGateway(ObjectMapper json,String token,HttpClient http,URI base){this.json=json;this.token=token;this.http=http;this.base=base;}
 public JsonNode post(String action,Object body)throws Exception{
  if(!Set.of("send","getReceipts").contains(action))throw new IllegalArgumentException("Unknown notification action");
  var request=HttpRequest.newBuilder(base.resolve(action)).timeout(Duration.ofSeconds(12)).header("Content-Type","application/json").header("Accept","application/json");
  if(!token.isBlank())request.header("Authorization","Bearer "+token);
  var response=http.send(request.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build(),HttpResponse.BodyHandlers.ofString());
  if(response.statusCode()!=200)throw new IOException("Push provider HTTP "+response.statusCode());
  var result=json.readTree(response.body());if(result.has("errors"))throw new IOException("Push provider rejected the request");return result;
 }
}
