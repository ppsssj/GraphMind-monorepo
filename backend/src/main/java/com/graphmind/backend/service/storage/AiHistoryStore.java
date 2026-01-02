package com.graphmind.backend.service.storage;

import org.springframework.stereotype.Component;
import com.graphmind.backend.domain.ai.AiHistoryItem;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.nio.file.*;
import java.util.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;

@Component
public class AiHistoryStore {
    private final JsonMapper om;
    private final Path filePath = Paths.get("data", "ai_history.json");
    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock(true);

    private List<AiHistoryItem> items = new ArrayList<>();

    public AiHistoryStore(JsonMapper om) {
        this.om = om;
        load();
    }

    private void ensureDir() {
        try {
            Files.createDirectories(filePath.getParent());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private void load() {
        lock.writeLock().lock();
        try {
            ensureDir();
            if (!Files.exists(filePath)) {
                items = new ArrayList<>();
                flush();
                return;
            }
            byte[] raw = Files.readAllBytes(filePath);
            if (raw.length == 0) {
                items = new ArrayList<>();
                return;
            }
            items = om.readValue(raw, new TypeReference<List<AiHistoryItem>>() {});
        } catch (Exception e) {
            items = new ArrayList<>();
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void flush() {
        try {
            ensureDir();
            byte[] out = om.writerWithDefaultPrettyPrinter().writeValueAsBytes(items);
            Files.write(filePath, out, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public List<AiHistoryItem> listAll() {
        lock.readLock().lock();
        try {
            return new ArrayList<>(items);
        } finally {
            lock.readLock().unlock();
        }
    }

    public AiHistoryItem add(AiHistoryItem item, int hardCap) {
        lock.writeLock().lock();
        try {
            items.add(0, item); // 최신이 앞
            if (items.size() > hardCap) {
                items = new ArrayList<>(items.subList(0, hardCap));
            }
            flush();
            return item;
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void clearAll() {
        lock.writeLock().lock();
        try {
            items = new ArrayList<>();
            flush();
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void clearByTabId(String tabId) {
        lock.writeLock().lock();
        try {
            items.removeIf(x -> Objects.equals(x.getTabId(), tabId));
            flush();
        } finally {
            lock.writeLock().unlock();
        }
    }
}
