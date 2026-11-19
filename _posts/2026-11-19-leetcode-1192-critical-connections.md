---
title: "LeetCode 1192. Critical Connections in a Network (Hard)"
date: 2026-11-19
categories: [algorithm]
tags: [leetcode, graph, bridge, tarjan]
---

## 문제

간선 하나를 없앴을 때 그래프가 둘로 갈라지면 그 간선은 **critical connection(bridge)**이다. 모든 bridge를 찾는 문제다.

## 풀이 1 — 간선을 하나씩 끊어보기 (Brute Force)

```python
from typing import List
from collections import deque, defaultdict

class Solution:
    def criticalConnections(self, n: int, connections: List[List[int]]) -> List[List[int]]:
        adj = defaultdict(list)
        for a, b in connections:
            adj[a].append(b)
            adj[b].append(a)

        res = []
        for a, b in connections:
            adj[a].remove(b)
            adj[b].remove(a)

            seen = {a}
            q = deque([a])
            while q:
                x = q.popleft()
                for y in adj[x]:
                    if y not in seen:
                        seen.add(y)
                        q.append(y)

            if b not in seen:
                res.append([a, b])

            adj[a].append(b)
            adj[b].append(a)

        return res
```

### 왜 끊는가

bridge의 정의를 그대로 시뮬레이션하는 방식이다.

1. 간선 `(a, b)`를 잠깐 제거한다.
2. `a`에서 BFS를 돌린다.
3. `b`에 도달하지 못하면 `a`와 `b`를 잇는 경로가 그 간선뿐이었다는 뜻이므로 bridge다.
4. 다음 간선을 검사하기 전에 제거한 간선을 복구한다.

### 한계

간선 E개마다 BFS를 O(V+E)씩 수행하므로 **O(E·(V+E))**다. `list.remove`도 O(degree)라 비용이 더 붙는다. n ≤ 10⁵ 제약에서는 TLE가 난다.

## 풀이 2 — Tarjan 알고리즘 O(V+E)

DFS를 한 번만 돌리면서 각 정점의 방문 순서 `disc`와, back edge를 통해 닿을 수 있는 가장 이른 방문 순서 `low`를 기록한다. 트리 간선 `u → v`에서 `low[v] > disc[u]`이면 `v` 쪽 서브트리가 `u`나 그 조상으로 돌아올 길이 없다는 뜻이므로 bridge다.

```python
from typing import List
import sys

class Solution:
    def criticalConnections(self, n: int, connections: List[List[int]]) -> List[List[int]]:
        sys.setrecursionlimit(1 << 20)
        adj = [[] for _ in range(n)]
        for a, b in connections:
            adj[a].append(b)
            adj[b].append(a)

        disc = [-1] * n
        low = [0] * n
        res = []
        t = 0

        def dfs(u: int, parent: int) -> None:
            nonlocal t
            disc[u] = low[u] = t
            t += 1
            for v in adj[u]:
                if v == parent:
                    continue
                if disc[v] == -1:
                    dfs(v, u)
                    low[u] = min(low[u], low[v])
                    if low[v] > disc[u]:
                        res.append([u, v])
                else:
                    low[u] = min(low[u], disc[v])

        dfs(0, -1)
        return res
```

## 정리

| 방법 | 시간 복잡도 | 결과 |
|---|---|---|
| 간선 끊고 BFS | O(E·(V+E)) | TLE |
| Tarjan | O(V+E) | 통과 |
