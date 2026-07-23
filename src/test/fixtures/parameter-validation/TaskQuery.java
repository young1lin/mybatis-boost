package com.example.query;

import com.example.audit.AuditEntity;

public class TaskQuery extends AuditEntity {
    private String taskName;
    private Integer status;

    public String getTaskName() {
        return taskName;
    }

    public void setTaskName(String taskName) {
        this.taskName = taskName;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }
}
