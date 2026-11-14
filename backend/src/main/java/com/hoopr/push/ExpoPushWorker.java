package com.hoopr.push;

import com.fasterxml.jackson.databind.*;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;
import org.slf4j.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.*;

@Configuration(proxyBeanMethods=false) @EnableScheduling
@ConditionalOnProperty(name="hoopr.push.enabled",havingValue="true")
public class ExpoPushWorker {
 private static final Logger log=LoggerFactory.getLogger(ExpoPushWorker.class);
 private final PushStore store;private final ObjectMapper json;private final ExpoPushGateway gateway;
 public ExpoPushWorker(PushStore store,ObjectMapper json,ExpoPushGateway gateway){this.store=store;this.json=json;this.gateway=gateway;}
 @Scheduled(initialDelayString="${hoopr.push.delay:15000}",fixedDelayString="${hoopr.push.delay:15000}")
 public void deliver(){java.util.List<PushStore.Delivery> items=java.util.List.of();try{
  store.collect();items=store.claim();if(!items.isEmpty()){
   var payload=new ArrayList<Map<String,Object>>();for(var d:items)payload.add(Map.of("to",d.token(),"title",d.title(),"body",d.body(),"data",json.readTree(d.data()),"sound","default","priority","high","channelId","travel-updates","badge",d.badge()));
   JsonNode tickets=gateway.post("send",payload).path("data");if(!tickets.isArray()||tickets.size()!=items.size())throw new IllegalStateException("Unexpected Expo ticket response");
   for(int i=0;i<items.size();i++){var ticket=tickets.get(i);if("ok".equals(ticket.path("status").asText())&&!ticket.path("id").asText().isBlank())store.accepted(items.get(i).id(),ticket.path("id").asText());else{String error=ticket.path("details").path("error").asText("ProviderRejected");store.failed(items.get(i).id(),error,Set.of("DeviceNotRegistered","MessageTooBig","InvalidCredentials","MismatchSenderId").contains(error));}}
  }
 }catch(Exception failure){for(var item:items)store.retryClaim(item.id());log.warn("Push send check failed: {}",failure.getClass().getSimpleName());}
 try{
  var receipts=store.receipts();if(!receipts.isEmpty()){JsonNode result=gateway.post("getReceipts",Map.of("ids",receipts.stream().map(PushStore.Receipt::receiptId).toList())).path("data");for(var r:receipts){var item=result.path(r.receiptId());if("ok".equals(item.path("status").asText()))store.received(r.id());else if("error".equals(item.path("status").asText()))store.failed(r.id(),item.path("details").path("error").asText("ReceiptRejected"),true);}}
 }catch(Exception failure){log.warn("Push delivery check failed: {}",failure.getClass().getSimpleName());}}
}
