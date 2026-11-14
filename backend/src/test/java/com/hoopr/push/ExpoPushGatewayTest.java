package com.hoopr.push;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import java.net.*;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
class ExpoPushGatewayTest {
 HttpServer server;String response;int status;String authorization;
 @BeforeEach void start()throws Exception{status=200;response="{\"data\":[{\"status\":\"ok\",\"id\":\"receipt-id\"}]}";server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);server.createContext("/send",r->{authorization=r.getRequestHeaders().getFirst("Authorization");r.getRequestBody().readAllBytes();byte[] bytes=response.getBytes(StandardCharsets.UTF_8);r.sendResponseHeaders(status,bytes.length);r.getResponseBody().write(bytes);r.close();});server.start();}
 @AfterEach void stop(){server.stop(0);}
 ExpoPushGateway gateway(String token){return new ExpoPushGateway(new ObjectMapper(),token,HttpClient.newHttpClient(),URI.create("http://127.0.0.1:"+server.getAddress().getPort()+"/"));}
 @Test void sendsBatchAndReadsTickets()throws Exception{var result=gateway("test-only-token").post("send",List.of(Map.of("to","fake-token","body","QA")));assertEquals("receipt-id",result.path("data").get(0).path("id").asText());assertEquals("Bearer test-only-token",authorization);}
 @Test void providerFailureIsNotReportedAsDelivery(){status=503;assertThrows(java.io.IOException.class,()->gateway("").post("send",List.of()));}
 @Test void jsonRejectionAndMalformedResponsesFail(){response="{\"errors\":[{\"message\":\"rejected\"}]}";assertThrows(java.io.IOException.class,()->gateway("").post("send",List.of()));response="not json";assertThrows(Exception.class,()->gateway("").post("send",List.of()));}
}
