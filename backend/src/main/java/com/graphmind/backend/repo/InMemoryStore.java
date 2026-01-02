package com.graphmind.backend.repo;

import com.graphmind.backend.domain.*;
import org.springframework.stereotype.Component;

import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedDeque;

@Component
public class InMemoryStore {
    public final ConcurrentHashMap<String, User> users = new ConcurrentHashMap<>();
    public final ConcurrentHashMap<String, VaultItem> vaultItems = new ConcurrentHashMap<>();
    public final ConcurrentHashMap<String, StudioProject> studioProjects = new ConcurrentHashMap<>();
    public final ConcurrentLinkedDeque<HistoryEvent> history = new ConcurrentLinkedDeque<>();
}
